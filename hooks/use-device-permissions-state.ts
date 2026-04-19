import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { isExpectedAuthError } from "../lib/auth-errors";
import { backendApi } from "../lib/backend-api";
import { getExpoProjectId } from "../lib/config";
import { logger } from "../lib/logger";
import { configureAndroidNotificationChannel } from "../lib/mobile-notifications";
import { isOfflineLikeError } from "../lib/sync";

export type PermissionState = "unknown" | "granted" | "denied" | "unsupported";

const isExpoGo = Constants.executionEnvironment === "storeClient";
const isWeb = Platform.OS === "web";
const PUSH_REGISTRATION_RETRY_MS = 30_000;

function mapPermissionStatus(
  status: Location.PermissionStatus | Notifications.PermissionStatus
): PermissionState {
  if (status === "granted") return "granted";
  if (status === "denied") return "denied";
  return "unknown";
}

async function registerExpoPushToken(token: string) {
  await backendApi.post("/notifications/push/mobile-tokens", {
    token,
    platform: Platform.OS,
    provider: "expo",
  });
}

function isExpoProjectIdConfigurationError(error: unknown): boolean {
  let message = "";
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "string") {
    message = error;
  }

  return (
    message.includes("VALIDATION_ERROR") ||
    message.includes("projectId") ||
    message.includes("Project ID") ||
    message.includes("Expected an OK response, received: 400") ||
    message.includes("Firebase") ||
    message.includes("FCM") ||
    message.includes("google-services") ||
    message.includes("Default FirebaseApp")
  );
}

function getUnknownErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error && "message" in error) {
    return String(error.message);
  }
  return "";
}

export function useDevicePermissionsState(sessionActive: boolean) {
  const [locationPermission, setLocationPermission] = useState<PermissionState>(
    isWeb ? "unsupported" : "unknown"
  );
  const [backgroundLocationPermission, setBackgroundLocationPermission] =
    useState<PermissionState>(isWeb ? "unsupported" : "unknown");
  const [notificationPermission, setNotificationPermission] =
    useState<PermissionState>(isWeb || isExpoGo ? "unsupported" : "unknown");
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [lastLocation, setLastLocation] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [registrationRetryTick, setRegistrationRetryTick] = useState(0);
  const registeredTokenRef = useRef<string | null>(null);
  const registrationRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isWeb && !isExpoGo) {
      void configureAndroidNotificationChannel();
    }
  }, []);

  const clearRegistrationRetry = useCallback(() => {
    if (registrationRetryTimerRef.current) {
      clearTimeout(registrationRetryTimerRef.current);
      registrationRetryTimerRef.current = null;
    }
  }, []);

  const scheduleRegistrationRetry = useCallback(() => {
    clearRegistrationRetry();
    registrationRetryTimerRef.current = setTimeout(() => {
      registrationRetryTimerRef.current = null;
      setRegistrationRetryTick((value) => value + 1);
    }, PUSH_REGISTRATION_RETRY_MS);
  }, [clearRegistrationRetry]);

  useEffect(
    () => () => {
      clearRegistrationRetry();
    },
    [clearRegistrationRetry]
  );

  const loadCurrentLocation = useCallback(async () => {
    if (isWeb) {
      setLastLocation(null);
      return false;
    }

    try {
      const lastKnown = await Location.getLastKnownPositionAsync({});
      if (lastKnown) {
        setLastLocation({
          lat: lastKnown.coords.latitude,
          lng: lastKnown.coords.longitude,
        });
        return true;
      }
    } catch {
      // Ignore and fall through to a fresh location request.
    }

    try {
      const { coords } = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLastLocation({ lat: coords.latitude, lng: coords.longitude });
      return true;
    } catch {
      setLastLocation(null);
      return false;
    }
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
        registeredTokenRef.current = null;
        return;
      }

      const { status: locationStatus } =
        await Location.getForegroundPermissionsAsync();
      const nextLocationPermission = mapPermissionStatus(locationStatus);
      setLocationPermission(nextLocationPermission);

      const { status: backgroundLocationStatus } =
        await Location.getBackgroundPermissionsAsync();
      setBackgroundLocationPermission(mapPermissionStatus(backgroundLocationStatus));

      if (nextLocationPermission === "granted") {
        await loadCurrentLocation();
      } else {
        setLastLocation(null);
      }

      if (isExpoGo) {
        setNotificationPermission("unsupported");
        setExpoPushToken(null);
        registeredTokenRef.current = null;
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

  const requestBackgroundLocationPermission = useCallback(async () => {
    if (isWeb) return;

    setIsLoading(true);
    setLastError(null);
    try {
      let foregroundStatus = (await Location.getForegroundPermissionsAsync()).status;

      if (foregroundStatus !== "granted") {
        foregroundStatus = (await Location.requestForegroundPermissionsAsync()).status;
      }

      const nextLocationPermission = mapPermissionStatus(foregroundStatus);
      setLocationPermission(nextLocationPermission);

      if (nextLocationPermission !== "granted") {
        setBackgroundLocationPermission("denied");
        setLastLocation(null);
        return;
      }

      await loadCurrentLocation();

      if (isExpoGo) {
        setBackgroundLocationPermission("unsupported");
        return;
      }

      const { status: backgroundStatus } =
        await Location.requestBackgroundPermissionsAsync();
      setBackgroundLocationPermission(mapPermissionStatus(backgroundStatus));
    } catch (error) {
      setLastError(
        error instanceof Error
          ? error.message
          : "Failed to request background location"
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
      if (status === "granted") {
        await configureAndroidNotificationChannel();
      }
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
    if (sessionActive) {
      return;
    }

    clearRegistrationRetry();
    setExpoPushToken(null);
    registeredTokenRef.current = null;
  }, [clearRegistrationRetry, sessionActive]);

  useEffect(() => {
    if (
      !sessionActive ||
      isWeb ||
      isExpoGo ||
      notificationPermission !== "granted"
    ) {
      clearRegistrationRetry();
      setExpoPushToken(null);
      registeredTokenRef.current = null;
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        clearRegistrationRetry();
        await configureAndroidNotificationChannel();

        const projectId = getExpoProjectId();
        if (!projectId) {
          if (!cancelled) {
            setExpoPushToken(null);
            registeredTokenRef.current = null;
          }
          return;
        }

        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        const token = tokenData?.data ?? null;
        if (cancelled) {
          return;
        }

        if (!token || registeredTokenRef.current === token) {
          setExpoPushToken(token);
          return;
        }

        await registerExpoPushToken(token);
        if (cancelled) {
          return;
        }

        setExpoPushToken(token);
        registeredTokenRef.current = token;
        setLastError(null);
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (isExpoProjectIdConfigurationError(error)) {
          setExpoPushToken(null);
          registeredTokenRef.current = null;
          setLastError(
            "Push notification credentials are not configured for this build."
          );
          logger.warn(
            "Notifications",
            "Push credentials/configuration error:",
            getUnknownErrorMessage(error)
          );
          return;
        }

        if (isExpectedAuthError(error)) {
          setExpoPushToken(null);
          registeredTokenRef.current = null;
          setLastError(null);
          return;
        }

        if (isOfflineLikeError(error)) {
          scheduleRegistrationRetry();
          setLastError(null);
          logger.warn(
            "Notifications",
            "Push token registration deferred:",
            getUnknownErrorMessage(error)
          );
          return;
        }

        setLastError(
          error instanceof Error ? error.message : "Push registration failed"
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    clearRegistrationRetry,
    notificationPermission,
    registrationRetryTick,
    scheduleRegistrationRetry,
    sessionActive,
  ]);

  return useMemo(
    () => ({
      locationPermission,
      backgroundLocationPermission,
      notificationPermission,
      expoPushToken,
      lastLocation,
      isExpoGo,
      isWeb,
      isLoading,
      lastError,
      refreshPermissions,
      requestLocationPermission,
      requestBackgroundLocationPermission,
      requestNotificationPermission,
    }),
    [
      expoPushToken,
      isLoading,
      lastError,
      lastLocation,
      locationPermission,
      backgroundLocationPermission,
      notificationPermission,
      refreshPermissions,
      requestLocationPermission,
      requestBackgroundLocationPermission,
      requestNotificationPermission,
    ]
  );
}
