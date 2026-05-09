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

// Custom error class for API errors with more context
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Network errors that can be retried
const RETRYABLE_NETWORK_ERRORS = [
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "ENETUNREACH",
];

const RETRYABLE_HTTP_STATUS = [408, 429, 500, 502, 503, 504];

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithToken(
  apiUrl: string,
  path: string,
  init: RequestInit,
  accessToken: string,
  retries = MAX_RETRIES,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutMs = resolveApiTimeoutMs();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${apiUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "X-Client-Platform": "mobile",
        ...(init.headers || {}),
      },
    });

    // Retry on server errors
    if (RETRYABLE_HTTP_STATUS.includes(response.status) && retries > 0) {
      console.warn(`[API] Retrying ${path}, ${retries} attempts left`);
      await delay(RETRY_DELAY_MS);
      return fetchWithToken(apiUrl, path, init, accessToken, retries - 1);
    }

    return response;
  } catch (error) {
    // Check if error is retryable
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isRetryable =
      error instanceof Error &&
      (error.name === "AbortError" ||
        RETRYABLE_NETWORK_ERRORS.some((e) => errorMessage.includes(e)));

    if (isRetryable && retries > 0) {
      console.warn(
        `[API] Retrying ${path} after network error, ${retries} attempts left`,
      );
      await delay(RETRY_DELAY_MS);
      return fetchWithToken(apiUrl, path, init, accessToken, retries - 1);
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError(
        `Tempo agotado (${timeoutMs}ms). Verifique sua conexão.`,
        408,
        "TIMEOUT",
      );
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function parseErrorMessage(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as {
    message?: string;
    code?: string;
  } | null;

  const message = payload?.message || `Erro HTTP ${response.status}`;
  return message;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  retryCount = 0,
): Promise<T> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new ApiError(
      "Sesión expirada. Por favor, inicie sesión novamente.",
      401,
      "NO_SESSION",
    );
  }

  const apiUrl = await getBackendApiUrl();
  let response = await fetchWithToken(apiUrl, path, init, accessToken);

  // Handle 401 - try to refresh token
  if (response.status === 401 && retryCount === 0) {
    console.log("[API] Token expired, attempting refresh...");
    const refreshedToken = await refreshStoredAuthSession();
    if (refreshedToken) {
      response = await fetchWithToken(apiUrl, path, init, refreshedToken);
    }
  }

  // Handle specific HTTP errors with user-friendly messages
  if (!response.ok) {
    const message = await parseErrorMessage(response);

    switch (response.status) {
      case 400:
        throw new ApiError(message, 400, "BAD_REQUEST");
      case 401:
        throw new ApiError(
          "Sesión expirada. Por favor, inicie sesión nuevamente.",
          401,
          "UNAUTHORIZED",
        );
      case 403:
        throw new ApiError(
          "No tiene permisos para esta acción.",
          403,
          "FORBIDDEN",
        );
      case 404:
        throw new ApiError("Recurso no encontrado.", 404, "NOT_FOUND");
      case 422:
        throw new ApiError(message, 422, "VALIDATION_ERROR");
      case 500:
        throw new ApiError(
          "Error del servidor. Intente nuevamente más tarde.",
          500,
          "SERVER_ERROR",
        );
      case 502:
      case 503:
        throw new ApiError(
          "Servicio temporalmente unavailable. Intente nuevamente.",
          response.status,
          "SERVICE_UNAVAILABLE",
        );
      default:
        throw new ApiError(message, response.status, "UNKNOWN");
    }
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
