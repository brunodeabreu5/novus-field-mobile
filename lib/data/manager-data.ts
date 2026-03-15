import { supabase } from "../supabase";
import type { ManagerNotification, VendorPosition, VendorProfile } from "./types";

export async function fetchAlerts(userId: string): Promise<ManagerNotification[]> {
  const { data, error } = await supabase
    .from("manager_notifications")
    .select("id, alert_type, message, zone_name, vendor_name, created_at, read")
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as ManagerNotification[];
}

export async function fetchLatestVendorPositions(): Promise<VendorPosition[]> {
  const { data, error } = await supabase
    .from("vendor_positions")
    .select("id, vendor_id, latitude, longitude, recorded_at")
    .order("recorded_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as VendorPosition[];
}

export async function fetchVendorProfiles(): Promise<VendorProfile[]> {
  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "vendor");

  if (rolesError) {
    throw new Error(rolesError.message);
  }

  const ids = (roles || []).map((role) => role.user_id);
  if (ids.length === 0) {
    return [];
  }

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, role_title")
    .in("id", ids)
    .order("full_name");

  if (profilesError) {
    throw new Error(profilesError.message);
  }

  return (profiles || []).map((profile) => ({
    user_id: profile.id,
    full_name: profile.full_name,
    role_title: profile.role_title,
  }));
}
