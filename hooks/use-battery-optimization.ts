import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import {
  BatteryOptEnabled,
  OpenOptimizationSettings,
  RequestDisableOptimization,
} from "react-native-battery-optimization-check";
import { logger } from "../lib/logger";

export type BatteryOptState = "checking" | "disabled" | "enabled" | "unknown";

export function useBatteryOptimization() {
  const [state, setState] = useState<BatteryOptState>(
    Platform.OS === "android" ? "checking" : "unknown",
  );

  const check = useCallback(async () => {
    if (Platform.OS !== "android") {
      setState("unknown");
      return;
    }

    try {
      const isEnabled = await BatteryOptEnabled();
      setState(isEnabled ? "enabled" : "disabled");
    } catch (error) {
      logger.warn(
        "BatteryOptimization",
        "Failed to check battery optimization status:",
        error instanceof Error ? error.message : error,
      );
      setState("unknown");
    }
  }, []);

  const openSettings = useCallback(() => {
    if (Platform.OS !== "android") return;

    try {
      OpenOptimizationSettings();
    } catch (error) {
      logger.warn(
        "BatteryOptimization",
        "Failed to open optimization settings:",
        error instanceof Error ? error.message : error,
      );
    }
  }, []);

  const requestDisable = useCallback(async () => {
    if (Platform.OS !== "android") return;

    try {
      await RequestDisableOptimization();
      // Recheck after a short delay to reflect the user's choice
      setTimeout(() => {
        void check();
      }, 1000);
    } catch (error) {
      logger.warn(
        "BatteryOptimization",
        "Failed to request disable optimization:",
        error instanceof Error ? error.message : error,
      );
    }
  }, [check]);

  useEffect(() => {
    void check();
  }, [check]);

  return {
    state,
    isEnabled: state === "enabled",
    check,
    openSettings,
    requestDisable,
  };
}
