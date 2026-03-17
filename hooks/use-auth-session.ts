import { useCallback, useEffect, useState } from "react";
import { syncQueuedActions } from "../lib/sync";
import {
  clearDismissedProfilePrompt,
  isProfileComplete,
  isProfileDismissed,
} from "../lib/auth-data";
import type { AppRole, Profile } from "../contexts/AuthContext";
import {
  type AuthSession as Session,
  type AuthUser as User,
  getAuthSnapshot,
  initializeAuth,
  subscribeAuth,
} from "../lib/backend-auth";

export function useAuthSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileIncomplete, setProfileIncomplete] = useState(false);

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

  const initializeUser = useCallback(
    async (userId: string) => {
      await refreshProfile(userId);
      const snapshot = await getAuthSnapshot();
      setRole(snapshot.user?.id === userId ? snapshot.role : null);

      syncQueuedActions().then((count) => {
        if (count > 0) {
          console.log(`[Sync] Synced ${count} pending actions`);
        }
      });
    },
    [refreshProfile],
  );

  useEffect(() => {
    getAuthSnapshot().then((snapshot) => {
      setSession(snapshot.session);
      setUser(snapshot.user);
      setProfile(snapshot.profile);
      setRole(snapshot.role);
    });

    const unsubscribe = subscribeAuth(async (snapshot) => {
      setSession(snapshot.session);
      setUser(snapshot.user);
      setProfile(snapshot.profile);
      setRole(snapshot.role);

      if (snapshot.user) {
        await initializeUser(snapshot.user.id);
      } else {
        await resetAuthState();
      }

      setLoading(false);
    });

    initializeAuth()
      .then(async (snapshot) => {
        setSession(snapshot.session);
        setUser(snapshot.user);
        setProfile(snapshot.profile);
        setRole(snapshot.role);

        if (snapshot.user) {
          await initializeUser(snapshot.user.id);
        } else {
          await resetAuthState();
        }
      })
      .finally(() => {
        setLoading(false);
      });

    return () => {
      unsubscribe();
    };
  }, [initializeUser, resetAuthState]);

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
