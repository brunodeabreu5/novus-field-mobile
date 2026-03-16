import AsyncStorage from "@react-native-async-storage/async-storage";
import { requireOptionalNativeModule } from "expo-modules-core";

const BIOMETRIC_KEY_PREFIX = "biometric_enabled";
const AUTH_TYPE_FINGERPRINT = 1;
const AUTH_TYPE_FACIAL_RECOGNITION = 2;
const AUTH_TYPE_IRIS = 3;

export type BiometricAvailability = {
  available: boolean;
  enrolled: boolean;
  label: string;
};

function getBiometricPreferenceKey(userId: string) {
  return `${BIOMETRIC_KEY_PREFIX}:${userId}`;
}

type LocalAuthenticationNativeModule = {
  hasHardwareAsync: () => Promise<boolean>;
  isEnrolledAsync: () => Promise<boolean>;
  supportedAuthenticationTypesAsync: () => Promise<number[]>;
  authenticateAsync: (options: {
    promptMessage: string;
    cancelLabel: string;
    fallbackLabel: string;
  }) => Promise<{ success: boolean }>;
};

function loadLocalAuthentication(): LocalAuthenticationNativeModule | null {
  try {
    return requireOptionalNativeModule<LocalAuthenticationNativeModule>(
      "ExpoLocalAuthentication"
    );
  } catch {
    return null;
  }
}

function getBiometricLabel(types: number[]) {
  if (types.includes(AUTH_TYPE_FACIAL_RECOGNITION)) {
    return "reconocimiento facial";
  }

  if (types.includes(AUTH_TYPE_FINGERPRINT)) {
    return "huella digital";
  }

  if (types.includes(AUTH_TYPE_IRIS)) {
    return "iris";
  }

  return "biometria";
}

export async function getBiometricAvailability(): Promise<BiometricAvailability> {
  try {
    const localAuthentication = loadLocalAuthentication();

    if (!localAuthentication) {
      return {
        available: false,
        enrolled: false,
        label: "biometria",
      };
    }

    const hasHardware = await localAuthentication.hasHardwareAsync();

    if (!hasHardware) {
      return {
        available: false,
        enrolled: false,
        label: "biometria",
      };
    }

    const [enrolled, types] = await Promise.all([
      localAuthentication.isEnrolledAsync(),
      localAuthentication.supportedAuthenticationTypesAsync(),
    ]);

    return {
      available: true,
      enrolled,
      label: getBiometricLabel(types),
    };
  } catch {
    return {
      available: false,
      enrolled: false,
      label: "biometria",
    };
  }
}

export async function isBiometricEnabledForUser(userId: string) {
  const value = await AsyncStorage.getItem(getBiometricPreferenceKey(userId));
  return value === "true";
}

export async function setBiometricEnabledForUser(userId: string, enabled: boolean) {
  const key = getBiometricPreferenceKey(userId);

  if (enabled) {
    await AsyncStorage.setItem(key, "true");
    return;
  }

  await AsyncStorage.removeItem(key);
}

export async function authenticateWithBiometrics(promptMessage: string) {
  try {
    const localAuthentication = loadLocalAuthentication();

    if (!localAuthentication) {
      return false;
    }

    const result = await localAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: "Cancelar",
      fallbackLabel: "Usar clave del dispositivo",
    });

    return result.success;
  } catch {
    return false;
  }
}
