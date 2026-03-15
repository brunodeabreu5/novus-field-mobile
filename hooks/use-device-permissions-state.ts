import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { supabase } from "../lib/supabase";
import type { TablesInsert } from "../lib/types";
import { getExpoProjectId } from "../lib/config";

export type PermissionState = "unknown" | "granted" | "denied" | "unsupported";

const isExpoGo = Constants.appOwnership === "expo";
const isWeb = Platform.OS === "web";

function mapPermissionStatus(
  status: Location.PermissionStatus | Notifications.PermissionStatus
): PermissionState {
  if (status === "granted") return "granted";
  if (status === "denied") return "denied";
  return "unknown";
}

async function registerExpoPushToken(token: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("mobile_push_tokens")
    .upsert(
      {
        user_id: user.id,
        token,
        platform: Platform.OS,
        provider: "expo",
        last_seen_at: new Date().toISOString(),
      } as TablesInsert<"mobile_push_tokens">,
      { onConflict: "user_id,token" }
    );

  if (error) {
    throw new Error(error.message);
  }
}

export function useDevicePermissionsState(sessionActive: boolean) {
  const [locationPermission, setLocationPermission] = useState<PermissionState>(
    isWeb ? "unsupported" : "unknown"
  );
  const [notificationPermission, setNotificationPermission] =
    useState<PermissionState>(isWeb || isExpoGo ? "unsupported" : "unknown");
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [lastLocation, setLastLocation] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const handlerConfiguredRef = useRef(false);
  const registeredTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (isWeb || isExpoGo || handlerConfiguredRef.current) return;

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    handlerConfiguredRef.current = true;
  }, []);

  const loadCurrentLocation = useCallback(async () => {
    if (isWeb) {
      setLastLocation(null);
      return;
    }

    const { coords } = await Location.getCurrentPositionAsync({});
    setLastLocation({ lat: coords.latitude, lng: coords.longitude });
  }, []);

  const refreshPermissions = useCallback(async () => {
    setIsLoading(true);
    setLastError(null);

    try {
      if (isWeb) {
        setLocationPermission("unsupported");
        setNotificationPermission("unsupported");
        setLastLocation(null);
        setExpoPushToken(null);
        return;
      }

      const { status: locationStatus } =
        await Location.getForegroundPermissionsAsync();
      const nextLocationPermission = mapPermissionStatus(locationStatus);
      setLocationPermission(nextLocationPermission);

      if (nextLocationPermission === "granted") {
        await loadCurrentLocation();
      } else {
        setLastLocation(null);
      }

      if (isExpoGo) {
        setNotificationPermission("unsupported");
        setExpoPushToken(null);
        return;
      }

      const { status: notificationStatus } =
        await Notifications.getPermissionsAsync();
      setNotificationPermission(mapPermissionStatus(notificationStatus));
    } catch (error) {
      setLastError(
        error instanceof Error ? error.message : "Failed to refresh permissions"
      );
    } finally {
      setIsLoading(false);
    }
  }, [loadCurrentLocation]);

  const requestLocationPermission = useCallback(async () => {
    if (isWeb) return;

    setIsLoading(true);
    setLastError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const nextPermission = mapPermissionStatus(status);
      setLocationPermission(nextPermission);
      if (nextPermission === "granted") {
        if (!isExpoGo) {
          await Location.requestBackgroundPermissionsAsync();
        }
        await loadCurrentLocation();
      } else {
        setLastLocation(null);
      }
    } catch (error) {
      setLastError(
        error instanceof Error ? error.message : "Failed to request location"
      );
    } finally {
      setIsLoading(false);
    }
  }, [loadCurrentLocation]);

  const requestNotificationPermission = useCallback(async () => {
    if (isWeb || isExpoGo) return;

    setIsLoading(true);
    setLastError(null);
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      setNotificationPermission(mapPermissionStatus(status));
    } catch (error) {
      setLastError(
        error instanceof Error
          ? error.message
          : "Failed to request notifications"
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshPermissions();
  }, [refreshPermissions, sessionActive]);

  useEffect(() => {
    if (
      !sessionActive ||
      isWeb ||
      isExpoGo ||
      notificationPermission !== "granted"
    ) {
      return;
    }

    (async () => {
      try {
        const projectId = getExpoProjectId();
        if (!projectId) {
          setLastError("EXPO_PUBLIC_PROJECT_ID not configured");
          return;
        }

        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        const token = tokenData?.data ?? null;
        setExpoPushToken(token);

        if (!token || registeredTokenRef.current === token) {
          return;
        }

        await registerExpoPushToken(token);
        registeredTokenRef.current = token;
      } catch (error) {
        setLastError(
          error instanceof Error ? error.message : "Push registration failed"
        );
      }
    })();
  }, [notificationPermission, sessionActive]);

  return useMemo(
    () => ({
      locationPermission,
      notificationPermission,
      expoPushToken,
      lastLocation,
      isExpoGo,
      isWeb,
      isLoading,
      lastError,
      refreshPermissions,
      requestLocationPermission,
      requestNotificationPermission,
    }),
    [
      expoPushToken,
      isLoading,
      lastError,
      lastLocation,
      locationPermission,
      notificationPermission,
      refreshPermissions,
      requestLocationPermission,
      requestNotificationPermission,
    ]
  );
}
