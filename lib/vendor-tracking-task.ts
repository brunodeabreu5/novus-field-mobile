import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { logger } from "./logger";
import {
  getUnknownErrorMessage,
  isTransientLocationTaskError,
  processBackgroundLocationBatch,
} from "./vendor-tracking-core";
import {
  TRACKING_CACHE_MAX_AGE_MS,
  TRACKING_TASK_NAME,
  TRACKING_VENDOR_ID_KEY,
} from "./vendor-tracking-constants";

let taskDefined = false;

interface TrackingLocationBatch {
  locations?: Location.LocationObject[];
}

export function registerVendorTrackingBackgroundTask() {
  if (taskDefined) {
    return;
  }

  TaskManager.defineTask(
    TRACKING_TASK_NAME,
    async ({ data, error }: TaskManager.TaskManagerTaskBody<TrackingLocationBatch>) => {
      const vendorId = await AsyncStorage.getItem(TRACKING_VENDOR_ID_KEY);
      if (!vendorId) {
        logger.debug(
          "Tracking",
          "Tarefa de localização em background: vendor_id ausente no AsyncStorage",
        );
        return;
      }

      if (error) {
        if (!isTransientLocationTaskError(error)) {
          logger.warn("Tracking", "Background task error:", getUnknownErrorMessage(error));
        }
      }

      logger.debug("Tracking", "Tarefa de localização em background invocada", {
        locationCount: data?.locations?.length ?? 0,
      });

      await processBackgroundLocationBatch(
        vendorId,
        data?.locations ?? [],
        TRACKING_CACHE_MAX_AGE_MS,
      );
    }
  );
  taskDefined = true;
}

registerVendorTrackingBackgroundTask();
