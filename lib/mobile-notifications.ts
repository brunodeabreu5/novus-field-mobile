import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { logger } from "./logger";

export const DEFAULT_NOTIFICATION_CHANNEL_ID = "novusfield-default";

const isExpoGo = Constants.executionEnvironment === "storeClient";
const isWeb = Platform.OS === "web";
let notificationHandlerConfigured = false;
let notificationChannelConfigured = false;

export function configureMobileNotificationHandler() {
  if (isWeb || isExpoGo || notificationHandlerConfigured) {
    return;
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  notificationHandlerConfigured = true;
}

export async function configureAndroidNotificationChannel() {
  if (Platform.OS !== "android" || isExpoGo || notificationChannelConfigured) {
    return;
  }

  try {
    await Notifications.setNotificationChannelAsync(DEFAULT_NOTIFICATION_CHANNEL_ID, {
      name: "NovusField",
      importance: Notifications.AndroidImportance.HIGH,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: "default",
      vibrationPattern: [0, 250, 250, 250],
      enableVibrate: true,
      enableLights: true,
    });
    notificationChannelConfigured = true;
  } catch (error) {
    logger.warn(
      "Notifications",
      "Failed to configure Android notification channel:",
      error instanceof Error ? error.message : error
    );
  }
}

configureMobileNotificationHandler();
