import Constants from "expo-constants";
import { deriveBackendWsUrl } from "./config-utils";

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

export function resolveBackendApiUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL?.trim() || "http://localhost:4000/api";
}

export function resolveBackendWsUrl(): string {
  return deriveBackendWsUrl(resolveBackendApiUrl(), process.env.EXPO_PUBLIC_WS_URL);
}

export function resolveControlApiUrl(): string {
  return process.env.EXPO_PUBLIC_CONTROL_API_URL?.trim() || "http://localhost:4010/api";
}
