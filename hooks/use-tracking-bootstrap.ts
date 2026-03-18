import { useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useDevicePermissions } from "../contexts/DevicePermissionsContext";
import type { TrackingState } from "../providers/TrackingProvider";
import { useVendorTracking } from "./use-vendor-tracking";
import { useGeofence } from "./use-geofence";

export function useTrackingBootstrap() {
  const { user, profile, session, isVendor } = useAuth();
  const {
    locationPermission,
    backgroundLocationPermission,
    requestBackgroundLocationPermission,
  } = useDevicePermissions();
  const requestedPermissionRef = useRef<string | null>(null);
  const canTrack =
    !!user &&
    !!session &&
    isVendor &&
    locationPermission === "granted" &&
    backgroundLocationPermission === "granted";

  useEffect(() => {
    if (!user || !isVendor) {
      requestedPermissionRef.current = null;
      return;
    }

    if (
      locationPermission === "granted" &&
      backgroundLocationPermission === "granted"
    ) {
      requestedPermissionRef.current = null;
      return;
    }

    if (requestedPermissionRef.current === user.id) {
      return;
    }

    requestedPermissionRef.current = user.id;
    void requestBackgroundLocationPermission();
  }, [
    backgroundLocationPermission,
    isVendor,
    locationPermission,
    requestBackgroundLocationPermission,
    user,
  ]);

  const { error: trackingError } = useVendorTracking({
    enabled: canTrack,
    vendorId: user?.id,
  });

  const { error: geofenceError } = useGeofence({
    enabled: canTrack,
    vendorId: user?.id,
    vendorName: profile?.full_name ?? profile?.phone ?? "Vendedor",
    autoCheckIn: true,
    intervalMs: 5000,
  });

  let effectiveTrackingState: TrackingState = null;
  if (user && isVendor) {
    if (
      locationPermission !== "granted" ||
      backgroundLocationPermission !== "granted"
    ) {
      effectiveTrackingState = "denied";
    } else if (trackingError || geofenceError) {
      effectiveTrackingState = "error";
    } else {
      effectiveTrackingState = "background";
    }
  }

  let trackingErrorMessage = trackingError ?? geofenceError;
  if (
    user &&
    isVendor &&
    (locationPermission !== "granted" ||
      backgroundLocationPermission !== "granted")
  ) {
    trackingErrorMessage = "Permiso de ubicacion en segundo plano requerido";
  }

  return {
    trackingState: effectiveTrackingState,
    trackingError: trackingErrorMessage,
  };
}
