type MobileEnv = {
  EXPO_PUBLIC_PROJECT_ID?: string;
  EXPO_PUBLIC_API_URL?: string;
  EXPO_PUBLIC_WS_URL?: string;
  [key: string]: unknown;
};

export function getExpoProjectId(): string | undefined {
  const env = process.env as MobileEnv;
  return env.EXPO_PUBLIC_PROJECT_ID?.trim();
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
