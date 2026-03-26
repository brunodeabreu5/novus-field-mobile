import React, { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { isExpectedAuthError } from "../lib/auth-errors";
import { backendApi } from "../lib/backend-api";
import { logger } from "../lib/logger";

const CHAT_PRESENCE_INTERVAL_MS = 30_000;

export function ChatPresenceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, session, loading } = useAuth();
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const stopPresenceLoop = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    if (loading || !user || !session) {
      stopPresenceLoop();
      return;
    }

    const updatePresence = async () => {
      try {
        await backendApi.post("/chat/presence", {
          user_id: user.id,
          last_seen_at: new Date().toISOString(),
        });
      } catch (error) {
        if (isExpectedAuthError(error)) {
          stopPresenceLoop();
          return;
        }

        logger.error("Chat", "Failed to update global mobile chat presence", error);
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
  }, [loading, session, user]);

  return <>{children}</>;
}
