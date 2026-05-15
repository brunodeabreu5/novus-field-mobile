import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { Platform } from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { isExpectedAuthError } from "../lib/auth-errors";
import { logger } from "../lib/logger";
import {
  isFreshLocation,
  TRACKING_LOCATION_MAX_AGE_MS,
} from "../lib/location-utils";
import { NOTIFICATION_TEXTS } from "../lib/notifications";
import {
  getLastLocationCacheKey,
  normalizeTrackingLocation,
  persistPosition,
  publishTrackingHeartbeat,
  resolveCurrentLocation,
  type TrackingMode,
  type TrackingStatusMode,
} from "../lib/vendor-tracking-core";
import {
  TRACKING_ANDROID_BACKGROUND_DISPLACEMENT_M,
  TRACKING_ANDROID_BACKGROUND_INTERVAL_MS,
  TRACKING_BACKGROUND_DISPLACEMENT_M,
  TRACKING_CACHE_MAX_AGE_MS,
  TRACKING_BACKGROUND_HEARTBEAT_MS,
  TRACKING_FOREGROUND_HEARTBEAT_MS,
  TRACKING_INTERVAL_MS,
  TRACKING_LAST_LOCATION_KEY,
  TRACKING_TASK_NAME,
  TRACKING_VENDOR_ID_KEY,
} from "../lib/vendor-tracking-constants";

type MutableRef<T> = { current: T };

interface TrackingLifecycleHandlers {
  readonly active: () => boolean;
  readonly lastLocationRef: MutableRef<Location.LocationObject | null>;
  readonly pauseTrackingNetwork: () => void;
  readonly setError: (value: string | null) => void;
  readonly setTrackingState: (value: TrackingStatusMode | null) => void;
  readonly startHeartbeatLoop: (trackingMode: TrackingMode) => void;
}

async function runHeartbeatTick(
  vendorId: string,
  trackingMode: TrackingMode,
  handlers: TrackingLifecycleHandlers
) {
  const lastPositionAt = handlers.lastLocationRef.current?.timestamp
    ? new Date(handlers.lastLocationRef.current.timestamp).toISOString()
    : null;
  const heartbeatPayload = {
    trackingMode,
    lastPositionAt,
  } as const;

  if (trackingMode === "background") {
    try {
      await publishTrackingHeartbeat(vendorId, heartbeatPayload);
      if (handlers.active()) {
        handlers.setError(null);
        handlers.setTrackingState("background");
      }
    } catch (heartbeatError) {
      if (isExpectedAuthError(heartbeatError)) {
        handlers.pauseTrackingNetwork();
        if (handlers.active()) {
          handlers.setError(null);
          handlers.setTrackingState("background");
        }
        return;
      }

      const nextError =
        heartbeatError instanceof Error
          ? heartbeatError.message
          : "Tracking heartbeat error";
      if (handlers.active()) {
        handlers.setError(nextError);
        handlers.setTrackingState("error");
      }
    }

    return;
  }

  if (!handlers.lastLocationRef.current) {
    const currentLocation = await resolveCurrentLocation(vendorId, TRACKING_CACHE_MAX_AGE_MS);
    if (currentLocation === null) {
      await publishTrackingHeartbeat(vendorId, heartbeatPayload);
      return;
    }

    handlers.lastLocationRef.current = currentLocation;
  } else if (
    !isFreshLocation(handlers.lastLocationRef.current, TRACKING_LOCATION_MAX_AGE_MS)
  ) {
    const currentLocation = await resolveCurrentLocation(vendorId, TRACKING_CACHE_MAX_AGE_MS);
    if (currentLocation) {
      handlers.lastLocationRef.current = currentLocation;
    }
  }

  try {
    await persistPosition(vendorId, handlers.lastLocationRef.current, {
      force: true,
      trackingMode,
    }, TRACKING_CACHE_MAX_AGE_MS);
    if (handlers.active()) {
      handlers.setError(null);
    }
  } catch (heartbeatError) {
    if (isExpectedAuthError(heartbeatError)) {
      handlers.pauseTrackingNetwork();
      if (handlers.active()) {
        handlers.setError(null);
        handlers.setTrackingState(trackingMode);
      }
      return;
    }

    const nextError =
      heartbeatError instanceof Error
        ? heartbeatError.message
        : "Tracking heartbeat error";
    if (handlers.active()) {
      handlers.setError(nextError);
      handlers.setTrackingState("error");
    }
    await publishTrackingHeartbeat(vendorId, {
      trackingMode: "error",
      lastError: nextError,
      lastPositionAt: heartbeatPayload.lastPositionAt,
    });
  }
}

async function initializeTrackingSession(
  vendorId: string,
  backgroundEnabled: boolean,
  handlers: TrackingLifecycleHandlers
) {
  await AsyncStorage.setItem(TRACKING_VENDOR_ID_KEY, vendorId);

  const { status: foregroundStatus } = await Location.getForegroundPermissionsAsync();
  if (foregroundStatus !== "granted") {
    if (handlers.active()) {
      handlers.setTrackingState("denied");
    }
    await publishTrackingHeartbeat(vendorId, {
      trackingMode: "denied",
      lastError: "Location permission not granted",
    });
    throw new Error("Location permission not granted");
  }

  const { status: backgroundStatus } = await Location.getBackgroundPermissionsAsync();
  const canRunBackground = backgroundEnabled && backgroundStatus === "granted";
  const trackingMode: TrackingMode = canRunBackground ? "background" : "foreground_only";

  if (handlers.active()) {
    handlers.setTrackingState(trackingMode);
  }

  const started = await Location.hasStartedLocationUpdatesAsync(TRACKING_TASK_NAME);
  if (started && !canRunBackground) {
    await Location.stopLocationUpdatesAsync(TRACKING_TASK_NAME);
  }

  if (canRunBackground) {
    if (started) {
      await Location.stopLocationUpdatesAsync(TRACKING_TASK_NAME);
    }

    await Location.startLocationUpdatesAsync(TRACKING_TASK_NAME, {
      accuracy:
        Platform.OS === "android"
          ? Location.Accuracy.High
          : Location.Accuracy.BestForNavigation,
      timeInterval:
        Platform.OS === "android"
          ? TRACKING_ANDROID_BACKGROUND_INTERVAL_MS
          : TRACKING_INTERVAL_MS,
      distanceInterval:
        Platform.OS === "android"
          ? TRACKING_ANDROID_BACKGROUND_DISPLACEMENT_M
          : TRACKING_BACKGROUND_DISPLACEMENT_M,
      deferredUpdatesDistance:
        Platform.OS === "android" ? TRACKING_ANDROID_BACKGROUND_DISPLACEMENT_M : 0,
      deferredUpdatesInterval:
        Platform.OS === "android"
          ? TRACKING_ANDROID_BACKGROUND_INTERVAL_MS
          : 0,
      mayShowUserSettingsDialog: true,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: Platform.OS === "ios",
      activityType: Location.ActivityType.OtherNavigation,
      foregroundService: {
        notificationTitle: NOTIFICATION_TEXTS.tracking.foregroundService.title,
        notificationBody: NOTIFICATION_TEXTS.tracking.foregroundService.body,
        notificationColor: "#0f172a",
        killServiceOnDestroy: false,
      },
    });
  }

  const currentLocation = await resolveCurrentLocation(vendorId, TRACKING_CACHE_MAX_AGE_MS);
  if (currentLocation) {
    handlers.lastLocationRef.current = currentLocation;
    await persistPosition(vendorId, currentLocation, {
      force: !isFreshLocation(currentLocation, TRACKING_LOCATION_MAX_AGE_MS),
      trackingMode,
    }, TRACKING_CACHE_MAX_AGE_MS);
  }
  handlers.startHeartbeatLoop(trackingMode);

  if (handlers.active()) {
    handlers.setError(null);
  }

  return trackingMode;
}

async function resetTrackingLifecycle(
  stopTrackingCompletely: () => Promise<void>,
  handlers: TrackingLifecycleHandlers
) {
  handlers.pauseTrackingNetwork();
  if (handlers.active()) {
    handlers.setTrackingState(null);
    handlers.setError(null);
  }
  await stopTrackingCompletely();
}

function pauseTrackingLifecycle(handlers: TrackingLifecycleHandlers) {
  handlers.pauseTrackingNetwork();
  if (handlers.active()) {
    handlers.setError(null);
  }
}

async function handleTrackingFailure(
  vendorId: string,
  trackingError: unknown,
  handlers: TrackingLifecycleHandlers
) {
  if (isExpectedAuthError(trackingError)) {
    handlers.pauseTrackingNetwork();
    if (handlers.active()) {
      handlers.setError(null);
    }
    return;
  }

  const nextError =
    trackingError instanceof Error ? trackingError.message : "Location tracking error";
  if (handlers.active()) {
    handlers.setError(nextError);
    handlers.setTrackingState("error");
  }
  void publishTrackingHeartbeat(vendorId, {
    trackingMode: "error",
    lastError: nextError,
  });
}

export function useVendorTracking(options: {
  enabled: boolean;
  backgroundEnabled: boolean;
  vendorId?: string | null;
}) {
  const { enabled, backgroundEnabled, vendorId } = options;
  const { session, loading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [trackingState, setTrackingState] = useState<TrackingStatusMode | null>(null);
  const lastLocationRef = useRef<Location.LocationObject | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let foregroundSubscription: Location.LocationSubscription | null = null;
    let active = true;
    const isActive = () => active;

    const stopHeartbeatLoop = () => {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
    };

    const pauseTrackingNetwork = () => {
      stopHeartbeatLoop();

      if (foregroundSubscription) {
        foregroundSubscription.remove();
        foregroundSubscription = null;
      }
    };

    const startHeartbeatLoop = (trackingMode: TrackingMode) => {
      stopHeartbeatLoop();
      const intervalMs =
        trackingMode === "background"
          ? TRACKING_BACKGROUND_HEARTBEAT_MS
          : TRACKING_FOREGROUND_HEARTBEAT_MS;

      heartbeatTimerRef.current = setInterval(() => {
        void runHeartbeatTick(vendorId!, trackingMode, {
          active: isActive,
          lastLocationRef,
          pauseTrackingNetwork,
          setError,
          setTrackingState,
          startHeartbeatLoop,
        });
      }, intervalMs);
    };

    const handleForegroundLocation = async (
      location: Location.LocationObject,
      trackingMode: TrackingMode
    ) => {
      const normalized = await normalizeTrackingLocation(
        vendorId!,
        location,
        TRACKING_CACHE_MAX_AGE_MS,
      );
      if (!normalized) {
        return;
      }

      lastLocationRef.current = normalized.location;
      await persistPosition(vendorId!, normalized.location, {
        force: normalized.forceTimestamp,
        trackingMode,
      }, TRACKING_CACHE_MAX_AGE_MS);

      if (isActive()) {
        setError(null);
        setTrackingState(trackingMode);
      }
    };

    const startForegroundWatch = async (trackingMode: TrackingMode) => {
      if (foregroundSubscription) {
        foregroundSubscription.remove();
        foregroundSubscription = null;
      }

        foregroundSubscription = await Location.watchPositionAsync(
        {
          accuracy:
            Platform.OS === "android"
              ? Location.Accuracy.High
              : Location.Accuracy.BestForNavigation,
          timeInterval: TRACKING_INTERVAL_MS,
          distanceInterval: TRACKING_BACKGROUND_DISPLACEMENT_M,
          mayShowUserSettingsDialog: true,
        },
        (location) => {
          void handleForegroundLocation(location, trackingMode).catch(async (watchError) => {
            if (isExpectedAuthError(watchError)) {
              pauseTrackingNetwork();
              if (isActive()) {
                setError(null);
                setTrackingState(trackingMode);
              }
              return;
            }

            const nextError =
              watchError instanceof Error
                ? watchError.message
                : "Foreground location tracking error";
            if (isActive()) {
              setError(nextError);
              setTrackingState("error");
            }
            await publishTrackingHeartbeat(vendorId!, {
              trackingMode: "error",
              lastError: nextError,
            });
          });
        },
        (watchError) => {
          const nextError =
            typeof watchError === "string" ? watchError : "Foreground location watch error";
          if (isActive()) {
            setError(nextError);
            setTrackingState("error");
          }
          void publishTrackingHeartbeat(vendorId!, {
            trackingMode: "error",
            lastError: nextError,
          });
        }
      );
    };

    const stopTrackingCompletely = async () => {
      pauseTrackingNetwork();

      const started = await Location.hasStartedLocationUpdatesAsync(TRACKING_TASK_NAME);
      if (started) {
        await Location.stopLocationUpdatesAsync(TRACKING_TASK_NAME);
      }

      await AsyncStorage.removeItem(TRACKING_VENDOR_ID_KEY);
      await AsyncStorage.removeItem(TRACKING_LAST_LOCATION_KEY);
      if (vendorId) {
        await AsyncStorage.removeItem(getLastLocationCacheKey(vendorId));
      }
    };

    const startTracking = async () => {
      if (!enabled || !vendorId) {
        await resetTrackingLifecycle(stopTrackingCompletely, {
          active: isActive,
          lastLocationRef,
          pauseTrackingNetwork,
          setError,
          setTrackingState,
          startHeartbeatLoop,
        });
        return;
      }

      if (loading) {
        pauseTrackingLifecycle({
          active: isActive,
          lastLocationRef,
          pauseTrackingNetwork,
          setError,
          setTrackingState,
          startHeartbeatLoop,
        });
        return;
      }

      if (!session) {
        await resetTrackingLifecycle(stopTrackingCompletely, {
          active: isActive,
          lastLocationRef,
          pauseTrackingNetwork,
          setError,
          setTrackingState,
          startHeartbeatLoop,
        });
        return;
      }

      try {
        const trackingMode = await initializeTrackingSession(vendorId, backgroundEnabled, {
          active: isActive,
          lastLocationRef,
          pauseTrackingNetwork,
          setError,
          setTrackingState,
          startHeartbeatLoop,
        });
        if (!isActive()) {
          return;
        }
        if (trackingMode === "foreground_only") {
          await startForegroundWatch(trackingMode);
        }
      } catch (trackingError) {
        await handleTrackingFailure(vendorId, trackingError, {
          active: isActive,
          lastLocationRef,
          pauseTrackingNetwork,
          setError,
          setTrackingState,
          startHeartbeatLoop,
        });
      }
    };

    startTracking();

    return () => {
      active = false;
      pauseTrackingNetwork();

      if (!enabled || !vendorId || !session) {
        stopTrackingCompletely().catch((stopError) => {
          logger.warn(
            "Tracking", "Failed to stop:",
            stopError instanceof Error ? stopError.message : stopError
          );
        });
      }
    };
  }, [backgroundEnabled, enabled, loading, session, vendorId]);

  return { error, trackingState };
}
