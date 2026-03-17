import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { useAuth } from "../contexts/AuthContext";
import { isExpectedAuthError } from "../lib/auth-errors";
import { backendApi } from "../lib/backend-api";
import { offlineStorage } from "../lib/offline-storage";
import { isOfflineLikeError } from "../lib/sync";

const TRACKING_TASK_NAME = "novus-vendor-background-tracking";
const TRACKING_VENDOR_ID_KEY = "novus_tracking_vendor_id";
const TRACKING_LAST_LOCATION_KEY = "novus_tracking_last_location";
const TRACKING_INTERVAL_MS = 10_000;
const TRACKING_MIN_DISPLACEMENT_M = 10;
const TRACKING_HEARTBEAT_MS = 60_000;

let taskDefined = false;

interface TrackingLocationBatch {
  locations?: Location.LocationObject[];
}

interface TrackingPersistenceOptions {
  force?: boolean;
  trackingMode: "background" | "foreground_only";
}

function haversineDistanceMeters(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusM = 6_371_000;
  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.latitude)) *
      Math.cos(toRad(to.latitude)) *
      Math.sin(dLng / 2) ** 2;

  return 2 * earthRadiusM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function publishTrackingHeartbeat(
  vendorId: string,
  payload: {
    trackingMode: "background" | "foreground_only" | "denied" | "error";
    lastPositionAt?: string | null;
    lastError?: string | null;
  }
) {
  await backendApi.post("/tracking/status", {
    vendor_id: vendorId,
    tracking_mode: payload.trackingMode,
    last_heartbeat_at: new Date().toISOString(),
    last_position_at: payload.lastPositionAt ?? null,
    last_error: payload.lastError ?? null,
  }).catch((error) => {
    if (!isOfflineLikeError(error) && !isExpectedAuthError(error)) {
      console.warn(
        "[Tracking] Heartbeat update failed:",
        error instanceof Error ? error.message : error,
      );
    }
    return null;
  });
}

async function persistPosition(
  vendorId: string,
  loc: Location.LocationObject,
  options: TrackingPersistenceOptions
) {
  const timestampIso = loc.timestamp
    ? new Date(loc.timestamp).toISOString()
    : new Date().toISOString();
  let isIdle = false;
  let idleDurationSeconds: number | null = null;

  const lastLocationRaw = await AsyncStorage.getItem(TRACKING_LAST_LOCATION_KEY);
  if (lastLocationRaw) {
    try {
      const previous = JSON.parse(lastLocationRaw) as {
        latitude: number;
        longitude: number;
        timestamp: number;
      };
      const distance = haversineDistanceMeters(
        { latitude: previous.latitude, longitude: previous.longitude },
        { latitude: loc.coords.latitude, longitude: loc.coords.longitude }
      );
      const elapsedSeconds = Math.max(
        0,
        Math.round(((loc.timestamp ?? Date.now()) - previous.timestamp) / 1000)
      );

      if (distance < TRACKING_MIN_DISPLACEMENT_M) {
        isIdle = true;
        idleDurationSeconds = elapsedSeconds;
      }
    } catch {
      // Ignore corrupt cache and continue with fresh state.
    }
  }

  const payload = {
    vendor_id: vendorId,
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    accuracy_meters: loc.coords.accuracy ?? null,
    speed_kmh: loc.coords.speed != null ? loc.coords.speed * 3.6 : null,
    heading: loc.coords.heading ?? null,
    idle_duration_seconds: idleDurationSeconds,
    is_idle: isIdle,
    recorded_at: timestampIso,
  };

  try {
    await backendApi.post("/tracking/positions", {
      vendor_id: vendorId,
      latitude: payload.latitude,
      longitude: payload.longitude,
      accuracy_meters: payload.accuracy_meters,
      speed_kmh: payload.speed_kmh,
      heading: payload.heading,
      idle_duration_seconds: payload.idle_duration_seconds,
      is_idle: payload.is_idle,
      recorded_at: payload.recorded_at,
    });
  } catch (error) {
    if (isExpectedAuthError(error)) {
      throw error;
    }

    if (isOfflineLikeError(error)) {
      await offlineStorage.enqueue({
        type: "vendor_position",
        payload: {
          vendorId,
          latitude: payload.latitude,
          longitude: payload.longitude,
          accuracyMeters: payload.accuracy_meters,
          speedKmh: payload.speed_kmh,
          heading: payload.heading,
          recordedAt: payload.recorded_at,
        },
      });
      return;
    }

    throw new Error(error instanceof Error ? error.message : "Tracking persistence failed");
  }

  await AsyncStorage.setItem(
    TRACKING_LAST_LOCATION_KEY,
    JSON.stringify({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      timestamp: loc.timestamp ?? Date.now(),
    })
  );

  publishTrackingHeartbeat(vendorId, {
    trackingMode: options.trackingMode,
    lastPositionAt: timestampIso,
  }).catch(() => undefined);
}

if (!taskDefined) {
  TaskManager.defineTask(
    TRACKING_TASK_NAME,
    async ({
      data,
      error,
    }: TaskManager.TaskManagerTaskBody<TrackingLocationBatch>) => {
      if (error) {
        console.warn("[Tracking] Background task error:", error.message);
        return;
      }

      const vendorId = await AsyncStorage.getItem(TRACKING_VENDOR_ID_KEY);
      if (!vendorId) {
        return;
      }

      const locations = data?.locations ?? [];
      for (const location of locations) {
        try {
          await persistPosition(vendorId, location, {
            trackingMode: "background",
          });
        } catch (insertError) {
          if (isExpectedAuthError(insertError)) {
            return;
          }

          console.warn(
            "[Tracking] Background position failed:",
            insertError instanceof Error ? insertError.message : insertError
          );
        }
      }
    }
  );
  taskDefined = true;
}

export function useVendorTracking(options: {
  enabled: boolean;
  vendorId?: string | null;
}) {
  const { enabled, vendorId } = options;
  const { session, loading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [trackingState, setTrackingState] = useState<
    "background" | "foreground_only" | "denied" | "error" | null
  >(null);
  const lastLocationRef = useRef<Location.LocationObject | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let foregroundSubscription: Location.LocationSubscription | null = null;
    let active = true;

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

    const startHeartbeatLoop = (trackingMode: "background" | "foreground_only") => {
      stopHeartbeatLoop();

      heartbeatTimerRef.current = setInterval(async () => {
        const heartbeatPayload = {
          trackingMode,
          lastPositionAt: lastLocationRef.current?.timestamp
            ? new Date(lastLocationRef.current.timestamp).toISOString()
            : null,
        } as const;

        if (!lastLocationRef.current) {
          try {
            const currentLocation = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            lastLocationRef.current = currentLocation;
          } catch {
            publishTrackingHeartbeat(vendorId!, heartbeatPayload).catch(
              () => undefined
            );
            return;
          }
        }

        try {
          await persistPosition(vendorId!, lastLocationRef.current, {
            force: true,
            trackingMode,
          });
          if (active) {
            setError(null);
          }
        } catch (heartbeatError) {
          if (isExpectedAuthError(heartbeatError)) {
            pauseTrackingNetwork();
            if (active) {
              setError(null);
              setTrackingState(trackingMode);
            }
            return;
          }

          const nextError =
            heartbeatError instanceof Error
              ? heartbeatError.message
              : "Tracking heartbeat error";
          if (active) {
            setError(nextError);
            setTrackingState("error");
          }
          publishTrackingHeartbeat(vendorId!, {
            trackingMode: "error",
            lastError: nextError,
            lastPositionAt: heartbeatPayload.lastPositionAt,
          }).catch(() => undefined);
        }
      }, TRACKING_HEARTBEAT_MS);
    };

    const stopTrackingCompletely = async () => {
      pauseTrackingNetwork();

      const started = await Location.hasStartedLocationUpdatesAsync(TRACKING_TASK_NAME);
      if (started) {
        await Location.stopLocationUpdatesAsync(TRACKING_TASK_NAME);
      }

      await AsyncStorage.removeItem(TRACKING_VENDOR_ID_KEY);
      await AsyncStorage.removeItem(TRACKING_LAST_LOCATION_KEY);
    };

    const startTracking = async () => {
      if (!enabled || !vendorId) {
        if (active) {
          setTrackingState(null);
          setError(null);
        }
        await stopTrackingCompletely();
        return;
      }

      if (loading) {
        pauseTrackingNetwork();
        if (active) {
          setError(null);
        }
        return;
      }

      if (!session) {
        pauseTrackingNetwork();
        if (active) {
          setError(null);
        }
        return;
      }

      try {
        await AsyncStorage.setItem(TRACKING_VENDOR_ID_KEY, vendorId);

        const { status: foregroundStatus } =
          await Location.getForegroundPermissionsAsync();
        if (foregroundStatus !== "granted") {
          if (active) {
            setTrackingState("denied");
          }
          publishTrackingHeartbeat(vendorId, {
            trackingMode: "denied",
            lastError: "Location permission not granted",
          }).catch(() => undefined);
          throw new Error("Location permission not granted");
        }

        const { status: backgroundStatus } =
          await Location.getBackgroundPermissionsAsync();

        if (backgroundStatus === "granted") {
          if (active) {
            setTrackingState("background");
          }
          const started = await Location.hasStartedLocationUpdatesAsync(
            TRACKING_TASK_NAME
          );

          if (!started) {
            await Location.startLocationUpdatesAsync(TRACKING_TASK_NAME, {
              accuracy: Location.Accuracy.Highest,
              timeInterval: TRACKING_INTERVAL_MS,
              distanceInterval: TRACKING_MIN_DISPLACEMENT_M,
              pausesUpdatesAutomatically: false,
              showsBackgroundLocationIndicator: true,
              foregroundService: {
                notificationTitle: "Novus Field tracking ativo",
                notificationBody: "Registrando localizacao do vendedor em campo.",
              },
            });
          }

          const currentLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          lastLocationRef.current = currentLocation;
          await persistPosition(vendorId, currentLocation, {
            trackingMode: "background",
          });
          startHeartbeatLoop("background");
          if (active) {
            setError(null);
          }
          return;
        }

        if (active) {
          setTrackingState("foreground_only");
        }

        foregroundSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: TRACKING_INTERVAL_MS,
            distanceInterval: TRACKING_MIN_DISPLACEMENT_M,
          },
          async (loc) => {
            try {
              lastLocationRef.current = loc;
              await persistPosition(vendorId, loc, {
                trackingMode: "foreground_only",
              });
              if (active) {
                setError(null);
                setTrackingState("foreground_only");
              }
            } catch (watchError) {
              if (isExpectedAuthError(watchError)) {
                pauseTrackingNetwork();
                if (active) {
                  setError(null);
                  setTrackingState("foreground_only");
                }
                return;
              }

              if (active) {
                setError(
                  watchError instanceof Error
                    ? watchError.message
                    : "Tracking error"
                );
                setTrackingState("error");
              }
            }
          }
        );
        startHeartbeatLoop("foreground_only");
      } catch (trackingError) {
        if (isExpectedAuthError(trackingError)) {
          pauseTrackingNetwork();
          if (active) {
            setError(null);
          }
          return;
        }

        if (active) {
          const nextError =
            trackingError instanceof Error
              ? trackingError.message
              : "Location tracking error";
          setError(nextError);
          setTrackingState((current) =>
            current === "denied" ? current : "error"
          );
          if (vendorId) {
            publishTrackingHeartbeat(vendorId, {
              trackingMode: "error",
              lastError: nextError,
            }).catch(() => undefined);
          }
        }
      }
    };

    startTracking();

    return () => {
      active = false;
      pauseTrackingNetwork();

      if (!enabled || !vendorId) {
        stopTrackingCompletely().catch((stopError) => {
          console.warn(
            "[Tracking] Failed to stop:",
            stopError instanceof Error ? stopError.message : stopError
          );
        });
      }
    };
  }, [enabled, loading, session, vendorId]);

  return { error, trackingState };
}
