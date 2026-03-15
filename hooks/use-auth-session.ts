import { useCallback, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { syncQueuedActions } from "../lib/sync";
import {
  clearDismissedProfilePrompt,
  clearStaleAuthStorage,
  fetchProfile,
  fetchRole,
  isProfileComplete,
  isProfileDismissed,
} from "../lib/auth-data";
import type { AppRole, Profile } from "../contexts/AuthContext";

export function useAuthSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileIncomplete, setProfileIncomplete] = useState(false);

  const refreshProfile = useCallback(async (userId: string) => {
    const nextProfile = await fetchProfile(userId);
    setProfile(nextProfile);

    if (!nextProfile) {
      setProfileIncomplete(false);
      return;
    }

    const dismissed = await isProfileDismissed();
    setProfileIncomplete(!isProfileComplete(nextProfile) && !dismissed);
  }, []);

  const refreshRole = useCallback(async (userId: string) => {
    const nextRole = await fetchRole(userId);
    setRole(nextRole);
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
      await Promise.all([refreshProfile(userId), refreshRole(userId)]);

      syncQueuedActions().then((count) => {
        if (count > 0) {
          console.log(`[Sync] Synced ${count} pending actions`);
        }
      });
    },
    [refreshProfile, refreshRole]
  );

  useEffect(() => {
    let initialized = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        await initializeUser(nextSession.user.id);
      } else {
        await resetAuthState();
      }

      if (initialized) {
        setLoading(false);
      }
    });

    supabase.auth
      .getSession()
      .then(async ({ data: { session: nextSession }, error }) => {
        initialized = true;

        if (error) {
          await clearStaleAuthStorage();
          await resetAuthState();
          setLoading(false);
          return;
        }

        setSession(nextSession);
        setUser(nextSession?.user ?? null);

        if (nextSession?.user) {
          await initializeUser(nextSession.user.id);
        }

        setLoading(false);
      })
      .catch(async () => {
        initialized = true;
        await clearStaleAuthStorage();
        await resetAuthState();
        setLoading(false);
      });

    return () => subscription.unsubscribe();
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
