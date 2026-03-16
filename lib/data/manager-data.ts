import { supabase } from "../supabase";
import { computeTrackingStats, type TrackPoint } from "../tracking-history";
import type {
  ManagerNotification,
  VendorPosition,
  VendorProfile,
  VendorRouteHistory,
} from "./types";

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

export async function fetchVendorRouteHistory(
  vendorId: string,
  date: string
): Promise<VendorRouteHistory> {
  const startOfDay = new Date(`${date}T00:00:00`);
  const endOfDay = new Date(`${date}T23:59:59.999`);
  const pageSize = 1000;
  const allRows: VendorPosition[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from("vendor_positions")
      .select(
        "id, vendor_id, latitude, longitude, accuracy_meters, speed_kmh, heading, is_idle, idle_duration_seconds, recorded_at"
      )
      .eq("vendor_id", vendorId)
      .gte("recorded_at", startOfDay.toISOString())
      .lte("recorded_at", endOfDay.toISOString())
      .order("recorded_at", { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      throw new Error(error.message);
    }

    if (data && data.length > 0) {
      allRows.push(...(data as VendorPosition[]));
      hasMore = data.length === pageSize;
      page += 1;
    } else {
      hasMore = false;
    }
  }

  const trail: TrackPoint[] = allRows.map((row) => ({
    lat: row.latitude,
    lng: row.longitude,
    accuracy: row.accuracy_meters ?? 0,
    speedKmh: row.speed_kmh ?? 0,
    heading: row.heading ?? null,
    isIdle: row.is_idle ?? false,
    idleDurationSec: row.idle_duration_seconds ?? 0,
    timestamp: new Date(row.recorded_at),
  }));

  return {
    trail,
    stats: computeTrackingStats(trail),
  };
}
