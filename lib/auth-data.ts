import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import type { AppRole, Profile } from "../contexts/AuthContext";

export const PROFILE_DISMISSED_KEY = "profile_dismissed";

export function isProfileComplete(profile: Profile | null): boolean {
  if (!profile) return false;
  return !!(profile.full_name && profile.phone && profile.role_title);
}

export async function isProfileDismissed(): Promise<boolean> {
  const value = await AsyncStorage.getItem(PROFILE_DISMISSED_KEY);
  return value === "true";
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as Profile;
}

export async function fetchRole(userId: string): Promise<AppRole> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .limit(1)
    .single();

  return data?.role ? (data.role as AppRole) : "vendor";
}

export async function clearStaleAuthStorage() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const authKeys = keys.filter(
      (key) => key.startsWith("sb-") && key.endsWith("-auth-token")
    );
    await Promise.all(authKeys.map((key) => AsyncStorage.removeItem(key)));
  } catch {
    // Ignore storage cleanup failures.
  }
}

export async function clearDismissedProfilePrompt() {
  await AsyncStorage.removeItem(PROFILE_DISMISSED_KEY);
}

export async function dismissProfilePromptStorage() {
  await AsyncStorage.setItem(PROFILE_DISMISSED_KEY, "true");
}
