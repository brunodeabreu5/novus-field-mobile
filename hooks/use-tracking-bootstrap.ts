import { useAuth } from "../contexts/AuthContext";
import { useDevicePermissions } from "../contexts/DevicePermissionsContext";
import type { TrackingState } from "../providers/TrackingProvider";
import { useVendorTracking } from "./use-vendor-tracking";
import { useGeofence } from "./use-geofence";

export function useTrackingBootstrap() {
  const { user, profile, session, isVendor } = useAuth();
  const { locationPermission, backgroundLocationPermission } = useDevicePermissions();
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
