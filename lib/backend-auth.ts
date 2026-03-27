import AsyncStorage from "@react-native-async-storage/async-storage";
import { getBackendApiUrl } from "./tenant-config";

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
  refresh_token: string;
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
  refreshToken: string;
  user: BackendUserPayload;
}

export interface AuthSnapshot {
  session: AuthSession | null;
  user: AuthUser | null;
  profile: AuthProfile | null;
  role: AppRole | null;
}

const AUTH_STORAGE_KEY = "backend_auth_session";
const listeners = new Set<(snapshot: AuthSnapshot) => void>();

let authStateMemory: StoredAuthState | null = null;
let authStateMemoryReady = false;

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

  const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
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
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    authStateMemory = null;
    authStateMemoryReady = true;
    return null;
  }
}

async function writeStoredState(state: StoredAuthState | null) {
  authStateMemory = state;
  authStateMemoryReady = true;

  if (!state) {
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }

  await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
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
    const errorPayload = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
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

export async function getCurrentUserId(): Promise<string | null> {
  return (await readStoredState())?.user.id ?? null;
}

export async function initializeAuth(): Promise<AuthSnapshot> {
  const current = await readStoredState();
  if (!current) {
    return toSnapshot(null);
  }

  try {
    const me = await request<BackendUserPayload>("/auth/me", { method: "GET" }, current.accessToken);
    const nextState: StoredAuthState = { ...current, user: me };
    await writeStoredState(nextState);
    emit(nextState);
    return toSnapshot(nextState);
  } catch {
    try {
      const refreshed = await request<BackendAuthResponse>("/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });
      return storeAuthResponse(refreshed);
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

export async function signUp(email: string, password: string, fullName: string) {
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
      await request<{ success: boolean }>(
        "/auth/logout",
        {
          method: "POST",
          body: JSON.stringify({ refreshToken: current.refreshToken }),
        },
        current.accessToken,
      );
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
