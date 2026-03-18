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
  trackingMode: "background";
}

interface CachedTrackingLocation {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
}

type MutableRef<T> = { current: T };

interface TrackingLifecycleHandlers {
  readonly active: () => boolean;
  readonly lastLocationRef: MutableRef<Location.LocationObject | null>;
  readonly pauseTrackingNetwork: () => void;
  readonly setError: (value: string | null) => void;
  readonly setTrackingState: (
    value: "background" | "denied" | "error" | null
  ) => void;
  readonly startHeartbeatLoop: (trackingMode: "background") => void;
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

function formatSpeedKmh(speed: number | null | undefined) {
  if (speed == null) {
    return null;
  }

  return speed * 3.6;
}

function buildIdleSnapshot(loc: Location.LocationObject) {
  const timestampMs = loc.timestamp ?? Date.now();
  const snapshot = {
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    timestamp: timestampMs,
    accuracy: loc.coords.accuracy ?? null,
    speed: loc.coords.speed ?? null,
    heading: loc.coords.heading ?? null,
  };

  return {
    snapshot,
    timestampMs,
  };
}

function buildLocationFromSnapshot(snapshot: CachedTrackingLocation) {
  return {
    coords: {
      latitude: snapshot.latitude,
      longitude: snapshot.longitude,
      accuracy: snapshot.accuracy ?? null,
      altitude: null,
      altitudeAccuracy: null,
      heading: snapshot.heading ?? null,
      speed: snapshot.speed ?? null,
    },
    timestamp: snapshot.timestamp,
    mocked: false,
  } as Location.LocationObject;
}

function calculateIdleState(
  loc: Location.LocationObject,
  lastLocationRaw: string | null
) {
  let isIdle = false;
  let idleDurationSeconds: number | null = null;

  if (lastLocationRaw !== null) {
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

  return { isIdle, idleDurationSeconds };
}

async function resolveCurrentLocation() {
  try {
    const lastKnown = await Location.getLastKnownPositionAsync({});
    if (lastKnown) {
      return lastKnown;
    }
  } catch {
    // Ignore and fall back to a live location request.
  }

  try {
    const cachedRaw = await AsyncStorage.getItem(TRACKING_LAST_LOCATION_KEY);
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw) as CachedTrackingLocation;
      if (
        typeof cached.latitude === "number" &&
        typeof cached.longitude === "number" &&
        typeof cached.timestamp === "number"
      ) {
        return buildLocationFromSnapshot(cached);
      }
    }
  } catch {
    // Ignore corrupted cache and continue to live location.
  }

  try {
    return await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
  } catch {
    return null;
  }
}

function isTransientLocationTaskError(error: unknown) {
  const message = getUnknownErrorMessage(error);

  return message.includes("kCLErrorDomain Code=0");
}

function getUnknownErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "";
}

async function persistVendorPositionInOfflineQueue(
  vendorId: string,
  payload: {
    latitude: number;
    longitude: number;
    accuracyMeters: number | null;
    speedKmh: number | null;
    heading: number | null;
    isIdle: boolean;
    idleDurationSeconds: number | null;
    recordedAt: string;
  }
) {
  await offlineStorage.enqueue({
    type: "vendor_position",
    payload: {
      vendorId,
      latitude: payload.latitude,
      longitude: payload.longitude,
      accuracyMeters: payload.accuracyMeters,
      speedKmh: payload.speedKmh,
      heading: payload.heading,
      isIdle: payload.isIdle,
      idleDurationSeconds: payload.idleDurationSeconds,
      recordedAt: payload.recordedAt,
    },
  });
}

async function processBackgroundLocationBatch(vendorId: string, locations: Location.LocationObject[]) {
  if (locations.length === 0) {
    const fallbackLocation = await resolveCurrentLocation();
    if (!fallbackLocation) {
      return;
    }

    try {
      await persistPosition(vendorId, fallbackLocation, {
        trackingMode: "background",
      });
    } catch (insertError) {
      if (isExpectedAuthError(insertError)) {
        return;
      }

      console.warn(
        "[Tracking] Background fallback position failed:",
        getUnknownErrorMessage(insertError)
      );
    }

    return;
  }

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
        getUnknownErrorMessage(insertError)
      );
    }
  }
}

async function runHeartbeatTick(
  vendorId: string,
  trackingMode: "background",
  handlers: TrackingLifecycleHandlers
) {
  const heartbeatPayload = {
    trackingMode,
    lastPositionAt: handlers.lastLocationRef.current?.timestamp
      ? new Date(handlers.lastLocationRef.current.timestamp).toISOString()
      : null,
  } as const;

  if (!handlers.lastLocationRef.current) {
    const currentLocation = await resolveCurrentLocation();
    if (currentLocation === null) {
      await publishTrackingHeartbeat(vendorId, heartbeatPayload);
      return;
    }

    handlers.lastLocationRef.current = currentLocation;
  }

  try {
    await persistPosition(vendorId, handlers.lastLocationRef.current, {
      force: true,
      trackingMode,
    });
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
  if (backgroundStatus !== "granted") {
    if (handlers.active()) {
      handlers.setTrackingState("denied");
      handlers.setError("Background location permission not granted");
    }
    await publishTrackingHeartbeat(vendorId, {
      trackingMode: "denied",
      lastError: "Background location permission not granted",
    });
    return false;
  }

  if (handlers.active()) {
    handlers.setTrackingState("background");
  }

  const started = await Location.hasStartedLocationUpdatesAsync(TRACKING_TASK_NAME);
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

  const currentLocation = await resolveCurrentLocation();
  if (currentLocation) {
    handlers.lastLocationRef.current = currentLocation;
    await persistPosition(vendorId, currentLocation, {
      trackingMode: "background",
    });
  }
  handlers.startHeartbeatLoop("background");

  if (handlers.active()) {
    handlers.setError(null);
  }

  return true;
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

async function publishTrackingHeartbeat(
  vendorId: string,
  payload: {
    trackingMode: "background" | "denied" | "error";
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
  const { snapshot: lastLocationSnapshot, timestampMs } = buildIdleSnapshot(loc);
  const timestampIso = new Date(timestampMs).toISOString();
  const lastLocationRaw = await AsyncStorage.getItem(TRACKING_LAST_LOCATION_KEY);
  const { isIdle, idleDurationSeconds } = calculateIdleState(loc, lastLocationRaw);

  try {
    await AsyncStorage.setItem(
      TRACKING_LAST_LOCATION_KEY,
      JSON.stringify(lastLocationSnapshot)
    );
  } catch (storageError) {
    console.warn(
      "[Tracking] Failed to persist last location cache:",
      storageError instanceof Error ? storageError.message : storageError
    );
  }

  const payload = {
    vendor_id: vendorId,
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    accuracy_meters: loc.coords.accuracy ?? null,
    speed_kmh: formatSpeedKmh(loc.coords.speed),
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
      await persistVendorPositionInOfflineQueue(vendorId, {
        latitude: payload.latitude,
        longitude: payload.longitude,
        accuracyMeters: payload.accuracy_meters,
        speedKmh: payload.speed_kmh,
        heading: payload.heading,
        isIdle: payload.is_idle,
        idleDurationSeconds: payload.idle_duration_seconds,
        recordedAt: payload.recorded_at,
      });
      return;
    }

    throw new Error(error instanceof Error ? error.message : "Tracking persistence failed");
  }

  publishTrackingHeartbeat(vendorId, {
    trackingMode: options.trackingMode,
    lastPositionAt: timestampIso,
  });
}

if (!taskDefined) {
  TaskManager.defineTask(
    TRACKING_TASK_NAME,
    async ({ data, error }: TaskManager.TaskManagerTaskBody<TrackingLocationBatch>) => {
      const vendorId = await AsyncStorage.getItem(TRACKING_VENDOR_ID_KEY);
      if (!vendorId) {
        return;
      }

      if (error) {
        if (!isTransientLocationTaskError(error)) {
          console.warn("[Tracking] Background task error:", getUnknownErrorMessage(error));
        }
      }

      await processBackgroundLocationBatch(vendorId, data?.locations ?? []);
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
    "background" | "denied" | "error" | null
  >(null);
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

    const startHeartbeatLoop = (trackingMode: "background") => {
      stopHeartbeatLoop();

      heartbeatTimerRef.current = setInterval(() => {
        void runHeartbeatTick(vendorId!, trackingMode, {
          active: isActive,
          lastLocationRef,
          pauseTrackingNetwork,
          setError,
          setTrackingState,
          startHeartbeatLoop,
        });
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
        const started = await initializeTrackingSession(vendorId, {
          active: isActive,
          lastLocationRef,
          pauseTrackingNetwork,
          setError,
          setTrackingState,
          startHeartbeatLoop,
        });
        if (!started) {
          return;
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
