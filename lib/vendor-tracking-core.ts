import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import {
  getStoredGeofenceVendorName,
  processGeofencePositionInBackground,
} from "../hooks/use-geofence";
import { isExpectedAuthError } from "./auth-errors";
import { backendApi } from "./backend-api";
import { logger } from "./logger";
import {
  recordBackgroundDelivery,
  recordBackgroundError,
} from "./tracking-diagnostics";
import { refreshStoredAuthSession } from "./backend-auth";
import {
  getFreshCurrentPosition,
  getFreshLastKnownPosition,
  isFreshLocation,
  isValidLocation,
  TRACKING_LOCATION_MAX_AGE_MS,
  TRACKING_LOCATION_REQUIRED_ACCURACY_M,
} from "./location-utils";
import { offlineStorage } from "./offline-storage";
import { isOfflineLikeError, syncQueuedTrackingActions } from "./sync";
import {
  TRACKING_LAST_LOCATION_KEY,
  TRACKING_MIN_DISPLACEMENT_M,
} from "./vendor-tracking-constants";

export type TrackingMode = "background" | "foreground_only";
export type TrackingStatusMode = TrackingMode | "denied" | "error";

export interface TrackingPersistenceOptions {
  force?: boolean;
  trackingMode: TrackingMode;
}

interface CachedTrackingLocation {
  vendorId: string;
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
}

function haversineDistanceMeters(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
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

export function getLastLocationCacheKey(vendorId: string) {
  return `${TRACKING_LAST_LOCATION_KEY}:${vendorId}`;
}

function isCachedTrackingLocation(
  value: unknown,
  vendorId: string,
): value is CachedTrackingLocation {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<CachedTrackingLocation>;
  return (
    candidate.vendorId === vendorId &&
    typeof candidate.latitude === "number" &&
    Number.isFinite(candidate.latitude) &&
    typeof candidate.longitude === "number" &&
    Number.isFinite(candidate.longitude) &&
    typeof candidate.timestamp === "number" &&
    Number.isFinite(candidate.timestamp)
  );
}

function buildIdleSnapshot(
  vendorId: string,
  loc: Location.LocationObject,
  forceFreshTimestamp = false,
) {
  const timestampMs = forceFreshTimestamp
    ? Date.now()
    : (loc.timestamp ?? Date.now());
  const snapshot = {
    vendorId,
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
  vendorId: string,
  loc: Location.LocationObject,
  lastLocationRaw: string | null,
  timestampMs: number,
) {
  let isIdle = false;
  let idleDurationSeconds: number | null = null;

  if (lastLocationRaw !== null) {
    try {
      const previous = JSON.parse(
        lastLocationRaw,
      ) as Partial<CachedTrackingLocation>;
      if (
        previous.vendorId !== vendorId ||
        typeof previous.latitude !== "number" ||
        typeof previous.longitude !== "number" ||
        typeof previous.timestamp !== "number"
      ) {
        return { isIdle, idleDurationSeconds };
      }

      const distance = haversineDistanceMeters(
        { latitude: previous.latitude, longitude: previous.longitude },
        { latitude: loc.coords.latitude, longitude: loc.coords.longitude },
      );
      const elapsedSeconds = Math.max(
        0,
        Math.round((timestampMs - previous.timestamp) / 1000),
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

async function loadCachedLocation(vendorId: string, cacheMaxAgeMs: number) {
  try {
    const cachedRaw = await AsyncStorage.getItem(
      getLastLocationCacheKey(vendorId),
    );
    if (!cachedRaw) {
      return null;
    }

    const cached = JSON.parse(cachedRaw) as unknown;
    if (!isCachedTrackingLocation(cached, vendorId)) {
      return null;
    }

    const cachedLocation = buildLocationFromSnapshot(cached);
    if (isFreshLocation(cachedLocation, cacheMaxAgeMs)) {
      return cachedLocation;
    }

    return null;
  } catch {
    return null;
  }
}

export async function resolveCurrentLocation(
  vendorId: string,
  cacheMaxAgeMs: number,
) {
  const lastKnown = await getFreshLastKnownPosition({
    maxAgeMs: TRACKING_LOCATION_MAX_AGE_MS,
    requiredAccuracyMeters: TRACKING_LOCATION_REQUIRED_ACCURACY_M,
  });
  if (lastKnown) {
    return lastKnown;
  }

  const cached = await loadCachedLocation(vendorId, cacheMaxAgeMs);
  if (cached) {
    return cached;
  }

  return getFreshCurrentPosition({ accuracy: Location.Accuracy.High });
}

export async function normalizeTrackingLocation(
  vendorId: string,
  location: Location.LocationObject,
  cacheMaxAgeMs: number,
) {
  if (isFreshLocation(location, TRACKING_LOCATION_MAX_AGE_MS)) {
    return { location, forceTimestamp: false };
  }

  const freshLocation = await resolveCurrentLocation(vendorId, cacheMaxAgeMs);
  if (freshLocation) {
    return { location: freshLocation, forceTimestamp: true };
  }

  if (isValidLocation(location)) {
    return { location, forceTimestamp: true };
  }

  return null;
}

export function isTransientLocationTaskError(error: unknown) {
  const message = getUnknownErrorMessage(error);

  return message.includes("kCLErrorDomain Code=0");
}

export function getUnknownErrorMessage(error: unknown) {
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
  },
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

export async function flushQueuedTrackingPositions(reason: string) {
  try {
    const synced = await syncQueuedTrackingActions();
    if (synced > 0) {
      logger.info(
        "Tracking",
        `Flushed ${synced} queued tracking position(s) after ${reason}`,
      );
    }
  } catch (error) {
    if (!isOfflineLikeError(error) && !isExpectedAuthError(error)) {
      logger.warn(
        "Tracking",
        `Failed to flush queued tracking after ${reason}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }
}

export async function publishTrackingHeartbeat(
  vendorId: string,
  payload: {
    trackingMode: TrackingStatusMode;
    lastPositionAt?: string | null;
    lastError?: string | null;
  },
) {
  await backendApi
    .post("/tracking/status", {
      vendor_id: vendorId,
      tracking_mode: payload.trackingMode,
      last_heartbeat_at: new Date().toISOString(),
      last_position_at: payload.lastPositionAt ?? null,
      last_error: payload.lastError ?? null,
    })
    .catch((error) => {
      if (!isOfflineLikeError(error) && !isExpectedAuthError(error)) {
        logger.warn(
          "Tracking",
          "Heartbeat update failed:",
          error instanceof Error ? error.message : error,
        );
      }
      return null;
    });
}

export async function persistPosition(
  vendorId: string,
  loc: Location.LocationObject,
  options: TrackingPersistenceOptions,
  cacheMaxAgeMs: number,
) {
  if (!isValidLocation(loc)) {
    throw new Error("Invalid GPS location");
  }

  const { snapshot: lastLocationSnapshot, timestampMs } = buildIdleSnapshot(
    vendorId,
    loc,
    options.force === true ||
      !isFreshLocation(loc, TRACKING_LOCATION_MAX_AGE_MS),
  );
  const timestampIso = new Date(timestampMs).toISOString();
  const lastLocationRaw = await AsyncStorage.getItem(
    getLastLocationCacheKey(vendorId),
  );
  const { isIdle, idleDurationSeconds } = calculateIdleState(
    vendorId,
    loc,
    lastLocationRaw,
    timestampMs,
  );

  // Calculate distance from last position
  let distanceMeters: number | null = null;
  if (lastLocationRaw) {
    try {
      const previous = JSON.parse(
        lastLocationRaw,
      ) as Partial<CachedTrackingLocation>;
      if (
        previous.vendorId === vendorId &&
        typeof previous.latitude === "number" &&
        typeof previous.longitude === "number"
      ) {
        distanceMeters = haversineDistanceMeters(
          { latitude: previous.latitude, longitude: previous.longitude },
          { latitude: loc.coords.latitude, longitude: loc.coords.longitude },
        );
      }
    } catch {
      // Ignore parse errors
    }
  }

  try {
    await AsyncStorage.setItem(
      getLastLocationCacheKey(vendorId),
      JSON.stringify(lastLocationSnapshot),
    );
    await AsyncStorage.removeItem(TRACKING_LAST_LOCATION_KEY);
  } catch (storageError) {
    logger.warn(
      "Tracking",
      "Failed to persist last location cache:",
      storageError instanceof Error ? storageError.message : storageError,
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
    distance_meters: distanceMeters,
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
    // For auth errors (including background mode), queue the position for later sync
    // This ensures tracking continues even when the session is unavailable
    if (isExpectedAuthError(error)) {
      logger.warn(
        "Tracking",
        `Auth error in ${options.trackingMode} mode - attempting silent refresh`,
      );

      // Attempt silent refresh before giving up and queuing
      const refreshedToken = await refreshStoredAuthSession();
      if (refreshedToken) {
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
          publishTrackingHeartbeat(vendorId, {
            trackingMode: options.trackingMode,
            lastPositionAt: timestampIso,
          });
          await flushQueuedTrackingPositions("silent refresh recovery");
          logger.info(
            "Tracking",
            `Silent refresh succeeded in ${options.trackingMode} mode - position sent`,
          );
          return;
        } catch (retryError) {
          logger.warn(
            "Tracking",
            `Silent refresh succeeded but position retry failed in ${options.trackingMode} mode`,
          );
        }
      }

      logger.warn(
        "Tracking",
        `Queuing position after failed refresh in ${options.trackingMode} mode`,
      );
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

    throw new Error(
      error instanceof Error ? error.message : "Tracking persistence failed",
    );
  }

  publishTrackingHeartbeat(vendorId, {
    trackingMode: options.trackingMode,
    lastPositionAt: timestampIso,
  });

  await flushQueuedTrackingPositions("position persistence");
}

export async function processBackgroundLocationBatch(
  vendorId: string,
  locations: Location.LocationObject[],
  cacheMaxAgeMs: number,
) {
  const geofenceVendorName = await getStoredGeofenceVendorName();
  const isFallback = locations.length === 0;

  if (isFallback) {
    const fallbackLocation = await resolveCurrentLocation(
      vendorId,
      cacheMaxAgeMs,
    );
    if (!fallbackLocation) {
      await recordBackgroundError("Fallback location resolution returned null");
      return;
    }

    try {
      await persistPosition(
        vendorId,
        fallbackLocation,
        {
          force: true,
          trackingMode: "background",
        },
        cacheMaxAgeMs,
      );
      await processGeofencePositionInBackground({
        position: {
          lat: fallbackLocation.coords.latitude,
          lng: fallbackLocation.coords.longitude,
          accuracy: fallbackLocation.coords.accuracy ?? 20,
        },
        vendorId,
        vendorName: geofenceVendorName,
      });
      await recordBackgroundDelivery({
        vendorId,
        locationCount: 0,
        wasFallback: true,
      });
    } catch (insertError) {
      if (isExpectedAuthError(insertError)) {
        await recordBackgroundError(
          `Auth error on fallback: ${getUnknownErrorMessage(insertError)}`,
        );
        return;
      }

      await recordBackgroundError(
        `Fallback persist failed: ${getUnknownErrorMessage(insertError)}`,
      );
      logger.warn(
        "Tracking",
        "Background fallback position failed:",
        getUnknownErrorMessage(insertError),
      );
    }

    return;
  }

  let persistedCount = 0;
  for (const location of locations) {
    const normalized = await normalizeTrackingLocation(
      vendorId,
      location,
      cacheMaxAgeMs,
    );
    if (!normalized) {
      logger.warn("Tracking", "Ignored invalid background location payload");
      continue;
    }

    try {
      await persistPosition(
        vendorId,
        normalized.location,
        {
          force: normalized.forceTimestamp,
          trackingMode: "background",
        },
        cacheMaxAgeMs,
      );
      await processGeofencePositionInBackground({
        position: {
          lat: normalized.location.coords.latitude,
          lng: normalized.location.coords.longitude,
          accuracy: normalized.location.coords.accuracy ?? 20,
        },
        vendorId,
        vendorName: geofenceVendorName,
      });
      persistedCount++;
    } catch (insertError) {
      if (isExpectedAuthError(insertError)) {
        await recordBackgroundError(
          `Auth error on batch: ${getUnknownErrorMessage(insertError)}`,
        );
        break;
      }

      await recordBackgroundError(
        `Batch persist failed: ${getUnknownErrorMessage(insertError)}`,
      );
      logger.warn(
        "Tracking",
        "Background position failed:",
        getUnknownErrorMessage(insertError),
      );
    }
  }

  if (persistedCount > 0) {
    await recordBackgroundDelivery({
      vendorId,
      locationCount: persistedCount,
      wasFallback: false,
    });
  }
}
