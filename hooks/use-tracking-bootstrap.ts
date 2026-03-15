import { useAuth } from "../contexts/AuthContext";
import { useDevicePermissions } from "../contexts/DevicePermissionsContext";
import { useVendorTracking } from "./use-vendor-tracking";
import { useGeofence } from "./use-geofence";

export function useTrackingBootstrap() {
  const { user, profile, isVendor } = useAuth();
  const { locationPermission } = useDevicePermissions();
  const canTrack = !!user && isVendor && locationPermission === "granted";

  useVendorTracking({
    enabled: canTrack,
    vendorId: user?.id,
  });

  useGeofence({
    enabled: canTrack,
    vendorId: user?.id,
    vendorName: profile?.full_name ?? profile?.phone ?? "Vendedor",
    autoCheckIn: true,
    intervalMs: 5000,
  });
}
