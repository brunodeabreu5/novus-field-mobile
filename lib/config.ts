import Constants from "expo-constants";

type MobileEnv = {
  EXPO_PUBLIC_PROJECT_ID?: string;
  EXPO_PUBLIC_API_URL?: string;
  EXPO_PUBLIC_WS_URL?: string;
  [key: string]: unknown;
};

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
  const env = process.env as MobileEnv;

  const easProjectId = normalizeProjectId(Constants.easConfig?.projectId);
  if (easProjectId) return easProjectId;

  const expoConfigProjectId = normalizeProjectId(
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)
      ?.eas?.projectId
  );
  if (expoConfigProjectId) return expoConfigProjectId;

  return normalizeProjectId(env.EXPO_PUBLIC_PROJECT_ID);
}

export function resolveBackendApiUrl(): string {
  const env = process.env as MobileEnv;
  return env.EXPO_PUBLIC_API_URL?.trim() || "http://localhost:4000/api";
}

export function resolveBackendWsUrl(): string {
  const env = process.env as MobileEnv;
  const explicit = env.EXPO_PUBLIC_WS_URL?.trim();
  if (explicit) {
    return explicit;
  }

  const apiUrl = resolveBackendApiUrl();
  return apiUrl.endsWith("/api") ? apiUrl.slice(0, -4) : apiUrl;
}
