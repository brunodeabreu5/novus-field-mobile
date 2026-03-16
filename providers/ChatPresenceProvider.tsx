import React, { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

const CHAT_PRESENCE_INTERVAL_MS = 30_000;

export function ChatPresenceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, session } = useAuth();
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user || !session) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const updatePresence = async () => {
      const { error } = await supabase.from("chat_presence").upsert(
        {
          user_id: user.id,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      if (error) {
        console.error("Failed to update global mobile chat presence", error);
      }
    };

    const startPresenceLoop = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      updatePresence().catch(() => undefined);
      intervalRef.current = setInterval(() => {
        updatePresence().catch(() => undefined);
      }, CHAT_PRESENCE_INTERVAL_MS);
    };

    const stopPresenceLoop = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    if (appStateRef.current === "active") {
      startPresenceLoop();
    }

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      appStateRef.current = nextAppState;

      if (nextAppState === "active") {
        startPresenceLoop();
      } else {
        stopPresenceLoop();
      }
    });

    return () => {
      subscription.remove();
      stopPresenceLoop();
    };
  }, [session, user]);

  return <>{children}</>;
}
