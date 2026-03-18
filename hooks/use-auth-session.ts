import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { syncQueuedActions } from "../lib/sync";
import {
  clearDismissedProfilePrompt,
  isProfileComplete,
  isProfileDismissed,
} from "../lib/auth-data";
import type { AppRole, Profile } from "../contexts/AuthContext";
import {
  type AuthSession as Session,
  type AuthSnapshot,
  type AuthUser as User,
  getAuthSnapshot,
  initializeAuth,
  subscribeAuth,
} from "../lib/backend-auth";

const AUTH_SYNC_INTERVAL_MS = 60_000;

export function useAuthSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncInFlightRef = useRef(false);

  const stopSyncLoop = useCallback(() => {
    if (syncTimerRef.current) {
      clearInterval(syncTimerRef.current);
      syncTimerRef.current = null;
    }
  }, []);

  const runQueuedSync = useCallback(async (sessionActive: boolean) => {
    if (syncInFlightRef.current || !sessionActive) {
      return 0;
    }

    syncInFlightRef.current = true;
    try {
      const count = await syncQueuedActions();
      if (count > 0) {
        console.log(`[Sync] Synced ${count} pending actions`);
      }
      return count;
    } finally {
      syncInFlightRef.current = false;
    }
  }, []);

  const startSyncLoop = useCallback((sessionActive: boolean) => {
    stopSyncLoop();
    runQueuedSync(sessionActive).catch(() => undefined);
    syncTimerRef.current = setInterval(() => {
      runQueuedSync(sessionActive).catch(() => undefined);
    }, AUTH_SYNC_INTERVAL_MS);
  }, [runQueuedSync, stopSyncLoop]);

  const handleAppStateChange = useCallback(
    (nextAppState: AppStateStatus) => {
      appStateRef.current = nextAppState;

      if (nextAppState === "active" && session && !loading) {
        startSyncLoop(true);
      } else {
        stopSyncLoop();
      }
    },
    [loading, session, startSyncLoop, stopSyncLoop],
  );

  const refreshProfile = useCallback(async (userId: string) => {
    const snapshot = await getAuthSnapshot();
    const nextProfile = snapshot.user?.id === userId ? snapshot.profile : null;
    setProfile(nextProfile);

    if (!nextProfile) {
      setProfileIncomplete(false);
      return;
    }

    const dismissed = await isProfileDismissed();
    setProfileIncomplete(!isProfileComplete(nextProfile) && !dismissed);
  }, []);

  const resetAuthState = useCallback(async () => {
    setSession(null);
    setUser(null);
    setProfile(null);
    setRole(null);
    setProfileIncomplete(false);
    await clearDismissedProfilePrompt();
  }, []);

  const applyAuthSnapshot = useCallback((snapshot: AuthSnapshot) => {
    setSession(snapshot.session);
    setUser(snapshot.user);
    setProfile(snapshot.profile);
    setRole(snapshot.role);
  }, []);

  const hydrateAuthenticatedUser = useCallback(
    async (snapshot: AuthSnapshot) => {
      if (!snapshot.user) {
        await resetAuthState();
        return;
      }

      applyAuthSnapshot(snapshot);
      await refreshProfile(snapshot.user.id);
      runQueuedSync(true).catch(() => undefined);
    },
    [applyAuthSnapshot, refreshProfile, resetAuthState, runQueuedSync],
  );

  const handleAuthSnapshot = useCallback(
    async (snapshot: AuthSnapshot) => {
      await hydrateAuthenticatedUser(snapshot);
      setLoading(false);
    },
    [hydrateAuthenticatedUser],
  );

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};

    const bootstrapAuth = async () => {
      try {
        const snapshot = await initializeAuth();
        if (cancelled) {
          return;
        }

        await handleAuthSnapshot(snapshot);
        unsubscribe = subscribeAuth((nextSnapshot) => {
          if (cancelled) {
            return;
          }

          void handleAuthSnapshot(nextSnapshot);
        });
      } catch {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void bootstrapAuth();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [handleAuthSnapshot]);

  useEffect(() => {
    if (appStateRef.current === "active" && session && !loading) {
      startSyncLoop(true);
    }

    const subscription = AppState.addEventListener("change", handleAppStateChange);

    return () => {
      subscription.remove();
      stopSyncLoop();
    };
  }, [handleAppStateChange, loading, session, startSyncLoop]);

  return {
    session,
    user,
    profile,
    role,
    loading,
    profileIncomplete,
    refreshProfile,
    setProfileIncomplete,
  };
}
