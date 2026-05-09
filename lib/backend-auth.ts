import AsyncStorage from "@react-native-async-storage/async-storage";
import { getBackendApiUrl } from "./tenant-config";

// expo-secure-store may not be available in all builds
let SecureStore: typeof import("expo-secure-store") | null = null;
try {
  SecureStore = require("expo-secure-store");
} catch (e) {
  console.warn(
    "[backend-auth] expo-secure-store not available, using AsyncStorage only",
  );
}

export type AppRole = "admin" | "manager" | "vendor";

export interface AuthProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  role_title: string | null;
  document: string | null;
  created_at: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthSession {
  access_token: string;
  refresh_token?: string;
  user: AuthUser;
}

interface BackendUserPayload {
  id: string;
  email: string;
  role: AppRole;
  profile: {
    fullName: string | null;
    avatarUrl: string | null;
    phone: string | null;
    roleTitle: string | null;
    document: string | null;
  };
  createdAt: string | null;
}

interface BackendAuthResponse {
  accessToken: string;
  refreshToken: string;
  user: BackendUserPayload;
}

interface StoredAuthState {
  accessToken: string;
  refreshToken?: string;
  user: BackendUserPayload;
}

export interface AuthSnapshot {
  session: AuthSession | null;
  user: AuthUser | null;
  profile: AuthProfile | null;
  role: AppRole | null;
}

const AUTH_STORAGE_KEY = "backend_auth_session";
// Use AFTER_FIRST_UNLOCK for background tracking support on Android
// This allows background tasks to access the token when the device was previously unlocked
// On iOS, the AsyncStorage fallback will be used when SecureStore is unavailable
// Note: This assumes expo-secure-store is available. If not, the SecureStore calls will be skipped.
// AFTER_FIRST_UNLOCK = 0
const SECURE_STORE_OPTIONS = {
  keychainAccessible: 0 as 0,
};
const listeners = new Set<(snapshot: AuthSnapshot) => void>();

let authStateMemory: StoredAuthState | null = null;
let authStateMemoryReady = false;

async function readAuthStorage(): Promise<string | null> {
  // Try SecureStore first if available
  if (SecureStore) {
    try {
      const secureValue = await SecureStore.getItemAsync(
        AUTH_STORAGE_KEY,
        SECURE_STORE_OPTIONS,
      );
      if (secureValue) {
        return secureValue;
      }
    } catch {}
  }

  // Fallback para AsyncStorage (útil em background quando SecureStore pode estar indisponível)
  const fallbackValue = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
  if (fallbackValue) {
    return fallbackValue;
  }

  return null;
}

function buildBackgroundFallbackState(state: StoredAuthState): StoredAuthState {
  return {
    accessToken: state.accessToken,
    user: state.user,
  };
}

async function writeAuthStorage(state: StoredAuthState | null) {
  if (state === null) {
    if (SecureStore) {
      try {
        await SecureStore.deleteItemAsync(
          AUTH_STORAGE_KEY,
          SECURE_STORE_OPTIONS,
        );
      } catch {}
    }
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }

  const secureValue = JSON.stringify(state);
  const fallbackValue = JSON.stringify(buildBackgroundFallbackState(state));

  // SecureStore guarda a sessão completa; AsyncStorage mantém apenas fallback
  // mínimo para tarefas em background, sem refresh token.
  if (SecureStore) {
    try {
      await SecureStore.setItemAsync(
        AUTH_STORAGE_KEY,
        secureValue,
        SECURE_STORE_OPTIONS,
      );
    } catch {
      // Mantém fallback mínimo abaixo para não quebrar background tracking.
    }
  }
  await AsyncStorage.setItem(AUTH_STORAGE_KEY, fallbackValue);
}

/** Call if `backend_auth_session` is removed outside this module (e.g. legacy cleanup). */
export function clearAuthMemoryCache() {
  authStateMemory = null;
  authStateMemoryReady = true;
}

function normalizeProfile(user: BackendUserPayload): AuthProfile {
  return {
    id: user.id,
    full_name: user.profile.fullName,
    avatar_url: user.profile.avatarUrl,
    phone: user.profile.phone,
    role_title: user.profile.roleTitle,
    document: user.profile.document,
    created_at: user.createdAt,
  };
}

function toSnapshot(state: StoredAuthState | null): AuthSnapshot {
  if (!state) {
    return {
      session: null,
      user: null,
      profile: null,
      role: null,
    };
  }

  return {
    session: {
      access_token: state.accessToken,
      refresh_token: state.refreshToken,
      user: {
        id: state.user.id,
        email: state.user.email,
      },
    },
    user: {
      id: state.user.id,
      email: state.user.email,
    },
    profile: normalizeProfile(state.user),
    role: state.user.role,
  };
}

async function readStoredState(): Promise<StoredAuthState | null> {
  if (authStateMemoryReady) {
    return authStateMemory;
  }

  const raw = await readAuthStorage();
  if (!raw) {
    authStateMemory = null;
    authStateMemoryReady = true;
    return null;
  }

  try {
    authStateMemory = JSON.parse(raw) as StoredAuthState;
    authStateMemoryReady = true;
    return authStateMemory;
  } catch {
    await writeAuthStorage(null);
    authStateMemory = null;
    authStateMemoryReady = true;
    return null;
  }
}

async function writeStoredState(state: StoredAuthState | null) {
  authStateMemory = state;
  authStateMemoryReady = true;

  if (!state) {
    await writeAuthStorage(null);
    return;
  }

  await writeAuthStorage(state);
}

function emit(state: StoredAuthState | null) {
  const snapshot = toSnapshot(state);
  listeners.forEach((listener) => listener(snapshot));
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const apiUrl = await getBackendApiUrl();
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(errorPayload?.message || `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function storeAuthResponse(data: BackendAuthResponse) {
  const nextState: StoredAuthState = {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    user: data.user,
  };

  return writeStoredState(nextState).then(() => {
    emit(nextState);
    return toSnapshot(nextState);
  });
}

export async function clearStoredAuthState() {
  await writeStoredState(null);
  emit(null);
}

export async function getAuthSnapshot(): Promise<AuthSnapshot> {
  return toSnapshot(await readStoredState());
}

export async function getAccessToken(): Promise<string | null> {
  return (await readStoredState())?.accessToken ?? null;
}

export async function refreshStoredAuthSession(): Promise<string | null> {
  const current = await readStoredState();
  if (!current) {
    return null;
  }

  try {
    if (!current.refreshToken) {
      await writeStoredState(null);
      emit(null);
      return null;
    }

    const refreshed = await request<BackendAuthResponse>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken: current.refreshToken }),
    });
    const snapshot = await storeAuthResponse(refreshed);
    return snapshot.session?.access_token ?? null;
  } catch {
    await writeStoredState(null);
    emit(null);
    return null;
  }
}

export async function getCurrentUserId(): Promise<string | null> {
  return (await readStoredState())?.user.id ?? null;
}

export async function initializeAuth(): Promise<AuthSnapshot> {
  const current = await readStoredState();
  if (!current) {
    return toSnapshot(null);
  }

  try {
    const me = await request<BackendUserPayload>(
      "/auth/me",
      { method: "GET" },
      current.accessToken,
    );
    const nextState: StoredAuthState = { ...current, user: me };
    await writeStoredState(nextState);
    emit(nextState);
    return toSnapshot(nextState);
  } catch {
    try {
      await refreshStoredAuthSession();
      return toSnapshot(await readStoredState());
    } catch {
      await writeStoredState(null);
      emit(null);
      return toSnapshot(null);
    }
  }
}

export function subscribeAuth(listener: (snapshot: AuthSnapshot) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function signIn(email: string, password: string) {
  const response = await request<BackendAuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  return storeAuthResponse(response);
}

export async function signUp(
  email: string,
  password: string,
  fullName: string,
) {
  const response = await request<BackendAuthResponse>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, fullName }),
  });
  return storeAuthResponse(response);
}

export async function signOut() {
  const current = await readStoredState();
  if (current) {
    try {
      if (current.refreshToken) {
        await request<{ success: boolean }>(
          "/auth/logout",
          {
            method: "POST",
            body: JSON.stringify({ refreshToken: current.refreshToken }),
          },
          current.accessToken,
        );
      }
    } catch {
      // Ignore backend logout failures during transition.
    }
  }

  await writeStoredState(null);
  emit(null);
}

export async function updateProfileRequest(data: Partial<AuthProfile>) {
  const current = await readStoredState();
  if (!current) {
    throw new Error("No active session");
  }

  const updatedUser = await request<BackendUserPayload>(
    "/auth/profile",
    {
      method: "PATCH",
      body: JSON.stringify({
        fullName: data.full_name,
        phone: data.phone,
        roleTitle: data.role_title,
        document: data.document,
      }),
    },
    current.accessToken,
  );

  const nextState: StoredAuthState = {
    ...current,
    user: updatedUser,
  };

  await writeStoredState(nextState);
  emit(nextState);

  return toSnapshot(nextState);
}
