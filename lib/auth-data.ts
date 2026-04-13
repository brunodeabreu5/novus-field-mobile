import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import type { Profile } from "../contexts/AuthContext";
import { clearAuthMemoryCache } from "./backend-auth";

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
  await SecureStore.deleteItemAsync("backend_auth_session");
  await AsyncStorage.removeItem("backend_auth_session");
  clearAuthMemoryCache();
}

export async function clearDismissedProfilePrompt() {
  await AsyncStorage.removeItem(PROFILE_DISMISSED_KEY);
}

export async function dismissProfilePromptStorage() {
  await AsyncStorage.setItem(PROFILE_DISMISSED_KEY, "true");
}
