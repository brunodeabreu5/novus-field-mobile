import { AppState, type AppStateStatus } from "react-native";
import * as Notifications from "expo-notifications";
import { logger } from "./logger";

let activeContactId: string | null = null;
let appState: AppStateStatus = AppState.currentState;

export function setActiveChatContactId(contactId: string | null) {
  activeContactId = contactId;
}

export function getActiveChatContactId(): string | null {
  return activeContactId;
}

export function isAppInForeground(): boolean {
  return appState === "active";
}

export function initNotificationSuppressListener() {
  const subscription = AppState.addEventListener("change", (nextAppState) => {
    appState = nextAppState;
    if (nextAppState !== "active") {
      activeContactId = null;
    }
  });

  const notificationSubscription = Notifications.addNotificationReceivedListener(
    async (notification) => {
      const data = notification.request.content.data as Record<string, unknown> | undefined;
      if (data?.type !== "chat") {
        return;
      }

      const contactId =
        typeof data.contactId === "string"
          ? data.contactId
          : typeof data.senderId === "string"
            ? data.senderId
            : null;

      // Suppress notification if app is in foreground
      if (appState === "active") {
        // Also suppress if viewing the exact conversation
        if (contactId && activeContactId === contactId) {
          logger.debug(
            "Notifications",
            `Suppressed chat notification for active conversation: ${contactId}`,
          );
        }

        try {
          await Notifications.dismissNotificationAsync(
            notification.request.identifier,
          );
        } catch {
          // Ignore dismiss errors
        }
      }
    },
  );

  return () => {
    subscription.remove();
    notificationSubscription.remove();
  };
}
