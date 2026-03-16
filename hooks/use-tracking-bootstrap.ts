import { useAuth } from "../contexts/AuthContext";
import { useDevicePermissions } from "../contexts/DevicePermissionsContext";
import type { TrackingState } from "../providers/TrackingProvider";
import { useVendorTracking } from "./use-vendor-tracking";
import { useGeofence } from "./use-geofence";

export function useTrackingBootstrap() {
  const { user, profile, isVendor } = useAuth();
  const { locationPermission, backgroundLocationPermission } =
    useDevicePermissions();
  const canTrack = !!user && isVendor && locationPermission === "granted";

  const { error: trackingError, trackingState } = useVendorTracking({
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

  const effectiveTrackingState: TrackingState =
    !user || !isVendor
      ? null
      : locationPermission !== "granted"
        ? "denied"
        : trackingError || geofenceError
          ? "error"
          : backgroundLocationPermission === "granted"
            ? "background"
            : trackingState === "foreground_only" ||
                trackingState === "background"
              ? "foreground_only"
              : "foreground_only";

  return {
    trackingState: effectiveTrackingState,
    trackingError: trackingError ?? geofenceError,
  };
}
