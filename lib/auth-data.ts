import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Profile } from "../contexts/AuthContext";
import { clearAuthMemoryCache } from "./backend-auth";

// expo-secure-store may not be available in all builds (e.g., web, some dev builds)
// Use try-catch at runtime to handle missing native module
let SecureStore: typeof import("expo-secure-store") | null = null;
try {
  SecureStore = require("expo-secure-store");
} catch (e) {
  console.warn(
    "[auth-data] expo-secure-store not available, using AsyncStorage only",
  );
}

export const PROFILE_DISMISSED_KEY = "profile_dismissed";

export function isProfileComplete(profile: Profile | null): boolean {
  if (!profile) return false;
  return !!(profile.full_name && profile.phone && profile.role_title);
}

export async function isProfileDismissed(): Promise<boolean> {
  const value = await AsyncStorage.getItem(PROFILE_DISMISSED_KEY);
  return value === "true";
}

export async function clearStaleAuthStorage() {
  if (SecureStore) {
    try {
      await SecureStore.deleteItemAsync("backend_auth_session");
    } catch {}
  }
  await AsyncStorage.removeItem("backend_auth_session");
  clearAuthMemoryCache();
}

export async function clearDismissedProfilePrompt() {
  await AsyncStorage.removeItem(PROFILE_DISMISSED_KEY);
}

export async function dismissProfilePromptStorage() {
  await AsyncStorage.setItem(PROFILE_DISMISSED_KEY, "true");
}
