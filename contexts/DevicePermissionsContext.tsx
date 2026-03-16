import React, { createContext, useContext } from "react";
import { useAuth } from "./AuthContext";
import {
  useDevicePermissionsState,
  type PermissionState,
} from "../hooks/use-device-permissions-state";

interface DevicePermissionsContextValue {
  locationPermission: PermissionState;
  backgroundLocationPermission: PermissionState;
  notificationPermission: PermissionState;
  expoPushToken: string | null;
  lastLocation: { lat: number; lng: number } | null;
  isExpoGo: boolean;
  isWeb: boolean;
  isLoading: boolean;
  lastError: string | null;
  refreshPermissions: () => Promise<void>;
  requestLocationPermission: () => Promise<void>;
  requestNotificationPermission: () => Promise<void>;
}

const DevicePermissionsContext = createContext<
  DevicePermissionsContextValue | undefined
>(undefined);

export function DevicePermissionsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session } = useAuth();
  const value = useDevicePermissionsState(!!session);

  return (
    <DevicePermissionsContext.Provider value={value}>
      {children}
    </DevicePermissionsContext.Provider>
  );
}

export function useDevicePermissions() {
  const context = useContext(DevicePermissionsContext);
  if (!context) {
    throw new Error(
      "useDevicePermissions must be used within DevicePermissionsProvider"
    );
  }
  return context;
}
