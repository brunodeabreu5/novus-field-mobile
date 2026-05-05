import { getAccessToken, refreshStoredAuthSession } from "./backend-auth";
import { resolveApiTimeoutMs } from "./config";
import { getBackendApiUrl } from "./tenant-config";

export type CollectionResponse<T> = {
  items?: T[];
  total?: number;
};

export function asArray<T>(payload: T[] | null | undefined): T[] {
  return Array.isArray(payload) ? payload : [];
}

export function asItemsArray<T>(
  payload: T[] | CollectionResponse<T> | null | undefined,
): T[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  return Array.isArray(payload?.items) ? payload.items : [];
}

async function fetchWithToken(
  apiUrl: string,
  path: string,
  init: RequestInit,
  accessToken: string,
) {
  const controller = new AbortController();
  const timeoutMs = resolveApiTimeoutMs();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(`${apiUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "X-Client-Platform": "mobile",
        ...(init.headers || {}),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function parseErrorMessage(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | { message?: string }
    | null;

  return payload?.message || `HTTP ${response.status}`;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new Error("No active backend session");
  }

  const apiUrl = await getBackendApiUrl();
  let response = await fetchWithToken(apiUrl, path, init, accessToken);

  if (response.status === 401) {
    const refreshedToken = await refreshStoredAuthSession();
    if (refreshedToken) {
      response = await fetchWithToken(apiUrl, path, init, refreshedToken);
    }
  }

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const backendApi = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
