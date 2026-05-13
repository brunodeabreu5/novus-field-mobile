declare module "react-native-battery-optimization-check" {
  export function BatteryOptEnabled(): Promise<boolean>;
  export function OpenOptimizationSettings(): void;
  export function RequestDisableOptimization(): Promise<void>;
}
