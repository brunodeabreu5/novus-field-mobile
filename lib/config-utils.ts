export function deriveBackendWsUrl(
  apiUrl: string,
  explicitWsUrl?: string | null
): string {
  const explicit = explicitWsUrl?.trim();
  if (explicit) {
    return explicit;
  }

  return apiUrl.endsWith("/api") ? apiUrl.slice(0, -4) : apiUrl;
}
