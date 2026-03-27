import Constants from "expo-constants";
import { deriveBackendWsUrl } from "./config-utils";

const DEV_BACKEND_API_URL = "http://localhost:4000/api";
const DEV_CONTROL_API_URL = "http://localhost:4010/api";

const INVALID_PROJECT_ID_VALUES = new Set([
  "",
  "your-expo-project-id",
  "undefined",
  "null",
]);

function normalizeProjectId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (INVALID_PROJECT_ID_VALUES.has(trimmed.toLowerCase())) return undefined;

  const uuidV4Like =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  return uuidV4Like.test(trimmed) ? trimmed : undefined;
}

export function getExpoProjectId(): string | undefined {
  const easProjectId = normalizeProjectId(Constants.easConfig?.projectId);
  if (easProjectId) return easProjectId;

  const expoConfigProjectId = normalizeProjectId(
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)
      ?.eas?.projectId
  );
  if (expoConfigProjectId) return expoConfigProjectId;

  return normalizeProjectId(process.env.EXPO_PUBLIC_PROJECT_ID);
}

function isLoopbackUrl(value: string): boolean {
  return /https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)([:/]|$)/i.test(value);
}

function resolveRequiredUrl(value: string | undefined, fallback: string, label: string): string {
  const trimmed = value?.trim();
  if (trimmed) {
    return trimmed;
  }

  if (__DEV__) {
    return fallback;
  }

  throw new Error(`${label} is required in the app environment.`);
}

export function resolveBackendApiUrl(): string {
  return resolveRequiredUrl(process.env.EXPO_PUBLIC_API_URL, DEV_BACKEND_API_URL, "EXPO_PUBLIC_API_URL");
}

export function resolveBackendWsUrl(): string {
  return deriveBackendWsUrl(resolveBackendApiUrl(), process.env.EXPO_PUBLIC_WS_URL);
}

export function resolveControlApiUrl(): string {
  return resolveRequiredUrl(
    process.env.EXPO_PUBLIC_CONTROL_API_URL,
    DEV_CONTROL_API_URL,
    "EXPO_PUBLIC_CONTROL_API_URL"
  );
}

export function getRuntimeConfigWarnings(): string[] {
  const warnings: string[] = [];
  const backendUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  const controlUrl = process.env.EXPO_PUBLIC_CONTROL_API_URL?.trim();

  if (!backendUrl) {
    warnings.push(`EXPO_PUBLIC_API_URL is not set. Using ${DEV_BACKEND_API_URL} in development.`);
  } else if (isLoopbackUrl(backendUrl)) {
    warnings.push("EXPO_PUBLIC_API_URL points to localhost/loopback and will not work on most physical devices.");
  }

  if (!controlUrl) {
    warnings.push(
      `EXPO_PUBLIC_CONTROL_API_URL is not set. Using ${DEV_CONTROL_API_URL} in development.`
    );
  } else if (isLoopbackUrl(controlUrl)) {
    warnings.push(
      "EXPO_PUBLIC_CONTROL_API_URL points to localhost/loopback and will not work on most physical devices."
    );
  }

  return warnings;
}

export {
  resolveMapboxToken,
  getMapboxRasterTileUrlTemplate,
  getMapboxMapStyle,
} from "./mapbox-tiles";

export function resolveApiTimeoutMs(): number {
  const timeout = process.env.EXPO_PUBLIC_API_TIMEOUT_MS;
  const parsed = parseInt(timeout || "", 10);
  return isNaN(parsed) ? 30_000 : Math.max(5_000, Math.min(120_000, parsed));
}
