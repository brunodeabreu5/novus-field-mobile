import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { supabase } from "../lib/supabase";
import { offlineStorage } from "../lib/offline-storage";
import { isOfflineLikeError } from "../lib/sync";

const TRACKING_TASK_NAME = "novus-vendor-background-tracking";
const TRACKING_VENDOR_ID_KEY = "novus_tracking_vendor_id";
const TRACKING_INTERVAL_MS = 10_000;
const TRACKING_MIN_DISPLACEMENT_M = 10;

let taskDefined = false;

interface TrackingLocationBatch {
  locations?: Location.LocationObject[];
}

async function persistPosition(vendorId: string, loc: Location.LocationObject) {
  const payload = {
    vendor_id: vendorId,
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    accuracy_meters: loc.coords.accuracy ?? null,
    speed_kmh: loc.coords.speed != null ? loc.coords.speed * 3.6 : null,
    heading: loc.coords.heading ?? null,
    idle_duration_seconds: null,
    is_idle: false,
    recorded_at: loc.timestamp ? new Date(loc.timestamp).toISOString() : new Date().toISOString(),
  };

  const { error } = await supabase.from("vendor_positions").insert(payload);

  if (error) {
    if (isOfflineLikeError(error)) {
      await offlineStorage.enqueue({
        type: "vendor_position",
        payload: {
          vendorId,
          latitude: payload.latitude,
          longitude: payload.longitude,
          accuracyMeters: payload.accuracy_meters,
          speedKmh: payload.speed_kmh,
          heading: payload.heading,
          recordedAt: payload.recorded_at,
        },
      });
      return;
    }

    throw new Error(error.message);
  }
}

if (!taskDefined) {
  TaskManager.defineTask(
    TRACKING_TASK_NAME,
    async ({
      data,
      error,
    }: TaskManager.TaskManagerTaskBody<TrackingLocationBatch>) => {
      if (error) {
        console.warn("[Tracking] Background task error:", error.message);
        return;
      }

      const vendorId = await AsyncStorage.getItem(TRACKING_VENDOR_ID_KEY);
      if (!vendorId) {
        return;
      }

      const locations = data?.locations ?? [];
      for (const location of locations) {
        try {
          await persistPosition(vendorId, location);
        } catch (insertError) {
          console.warn(
            "[Tracking] Background position failed:",
            insertError instanceof Error ? insertError.message : insertError
          );
        }
      }
    }
  );
  taskDefined = true;
}

export function useVendorTracking(options: {
  enabled: boolean;
  vendorId?: string | null;
}) {
  const { enabled, vendorId } = options;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let foregroundSubscription: Location.LocationSubscription | null = null;
    let active = true;

    const stopTracking = async () => {
      if (foregroundSubscription) {
        foregroundSubscription.remove();
        foregroundSubscription = null;
      }

      const started = await Location.hasStartedLocationUpdatesAsync(TRACKING_TASK_NAME);
      if (started) {
        await Location.stopLocationUpdatesAsync(TRACKING_TASK_NAME);
      }

      await AsyncStorage.removeItem(TRACKING_VENDOR_ID_KEY);
    };

    const startTracking = async () => {
      if (!enabled || !vendorId) {
        await stopTracking();
        return;
      }

      try {
        await AsyncStorage.setItem(TRACKING_VENDOR_ID_KEY, vendorId);

        const { status: foregroundStatus } =
          await Location.getForegroundPermissionsAsync();
        if (foregroundStatus !== "granted") {
          throw new Error("Location permission not granted");
        }

        const { status: backgroundStatus } =
          await Location.getBackgroundPermissionsAsync();

        if (backgroundStatus === "granted") {
          const started = await Location.hasStartedLocationUpdatesAsync(
            TRACKING_TASK_NAME
          );

          if (!started) {
            await Location.startLocationUpdatesAsync(TRACKING_TASK_NAME, {
              accuracy: Location.Accuracy.Balanced,
              timeInterval: TRACKING_INTERVAL_MS,
              distanceInterval: TRACKING_MIN_DISPLACEMENT_M,
              pausesUpdatesAutomatically: false,
              showsBackgroundLocationIndicator: true,
              foregroundService: {
                notificationTitle: "Novus Field tracking ativo",
                notificationBody: "Registrando localizacao do vendedor em campo.",
              },
            });
          }

          const currentLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          await persistPosition(vendorId, currentLocation);
          if (active) {
            setError(null);
          }
          return;
        }

        foregroundSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: TRACKING_INTERVAL_MS,
            distanceInterval: TRACKING_MIN_DISPLACEMENT_M,
          },
          async (loc) => {
            try {
              await persistPosition(vendorId, loc);
              if (active) {
                setError(null);
              }
            } catch (watchError) {
              if (active) {
                setError(
                  watchError instanceof Error
                    ? watchError.message
                    : "Tracking error"
                );
              }
            }
          }
        );
      } catch (trackingError) {
        if (active) {
          setError(
            trackingError instanceof Error
              ? trackingError.message
              : "Location tracking error"
          );
        }
      }
    };

    startTracking();

    return () => {
      active = false;
      if (foregroundSubscription) {
        foregroundSubscription.remove();
      }

      if (!enabled || !vendorId) {
        stopTracking().catch((stopError) => {
          console.warn(
            "[Tracking] Failed to stop:",
            stopError instanceof Error ? stopError.message : stopError
          );
        });
      }
    };
  }, [enabled, vendorId]);

  return { error };
}
