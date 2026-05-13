import * as Location from "expo-location";

export const DEFAULT_LOCATION_MAX_AGE_MS = 60_000;
export const TRACKING_LOCATION_MAX_AGE_MS = 120_000;
export const DEFAULT_LOCATION_REQUIRED_ACCURACY_M = 150;
export const TRACKING_LOCATION_REQUIRED_ACCURACY_M = 100;

export function isValidCoordinate(
  value: number | null | undefined,
  min: number,
  max: number
) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

export function isValidLocation(location: Location.LocationObject | null | undefined) {
  return (
    !!location &&
    isValidCoordinate(location.coords.latitude, -90, 90) &&
    isValidCoordinate(location.coords.longitude, -180, 180)
  );
}

export function isFreshLocation(
  location: Location.LocationObject | null | undefined,
  maxAgeMs: number
) {
  if (!location || !isValidLocation(location) || typeof location.timestamp !== "number") {
    return false;
  }

  const ageMs = Date.now() - location.timestamp;
  return ageMs >= 0 && ageMs <= maxAgeMs;
}

export async function getFreshLastKnownPosition(options: {
  maxAgeMs?: number;
  requiredAccuracyMeters?: number;
} = {}) {
  const maxAgeMs = options.maxAgeMs ?? DEFAULT_LOCATION_MAX_AGE_MS;
  const requiredAccuracy =
    options.requiredAccuracyMeters ?? DEFAULT_LOCATION_REQUIRED_ACCURACY_M;

  try {
    const location = await Location.getLastKnownPositionAsync({
      maxAge: maxAgeMs,
      requiredAccuracy,
    });

    return isFreshLocation(location, maxAgeMs) ? location : null;
  } catch {
    return null;
  }
}

export async function getFreshCurrentPosition(options: {
  accuracy?: Location.Accuracy;
} = {}) {
  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: options.accuracy ?? Location.Accuracy.BestForNavigation,
      mayShowUserSettingsDialog: true,
    });

    return isValidLocation(location) ? location : null;
  } catch {
    return null;
  }
}
