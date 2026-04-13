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
    requestLocationPermission,
    requestBackgroundLocationPermission,
  } = useDevicePermissions();
  const requestedForegroundRef = useRef<string | null>(null);
  const requestedBackgroundRef = useRef<string | null>(null);

  useEffect(() => {
    const sessionKey = session?.access_token ?? user?.id ?? null;

    if (!user || !session || !sessionKey) {
      requestedForegroundRef.current = null;
      requestedBackgroundRef.current = null;
      return;
    }

    if (locationPermission !== "granted" && requestedForegroundRef.current !== sessionKey) {
      requestedForegroundRef.current = sessionKey;
      void requestLocationPermission();
      return;
    }

    if (
      isVendor &&
      locationPermission === "granted" &&
      backgroundLocationPermission !== "granted" &&
      requestedBackgroundRef.current !== sessionKey
    ) {
      requestedBackgroundRef.current = sessionKey;
      void requestBackgroundLocationPermission();
    }
  }, [
    backgroundLocationPermission,
    isVendor,
    locationPermission,
    requestBackgroundLocationPermission,
    requestLocationPermission,
    session,
    user,
  ]);

  const canTrack =
    !!user &&
    !!session &&
    isVendor &&
    locationPermission === "granted" &&
    backgroundLocationPermission === "granted";

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
    if (locationPermission !== "granted") {
      effectiveTrackingState = "denied";
    } else if (backgroundLocationPermission !== "granted") {
      effectiveTrackingState = "foreground_only";
    } else if (trackingError || geofenceError) {
      effectiveTrackingState = "error";
    } else {
      effectiveTrackingState = "background";
    }
  }

  let trackingErrorMessage = trackingError ?? geofenceError;
  if (user && isVendor && locationPermission !== "granted") {
    trackingErrorMessage = "Permiso de ubicacion requerido";
  } else if (user && isVendor && backgroundLocationPermission !== "granted") {
    trackingErrorMessage =
      "Active la ubicacion en segundo plano para habilitar rastreo automatico continuo.";
  }

  return {
    trackingState: effectiveTrackingState,
    trackingError: trackingErrorMessage,
  };
}
