import { backendApi } from "../backend-api";
import { computeTrackingStats, type TrackPoint } from "../tracking-history";
import type {
  ManagerNotification,
  VendorPosition,
  VendorProfile,
  VendorRouteHistory,
} from "./types";

export async function fetchAlerts(userId: string): Promise<ManagerNotification[]> {
  return backendApi.get<ManagerNotification[]>(`/notifications/manager?userId=${userId}`);
}

export async function fetchLatestVendorPositions(): Promise<VendorPosition[]> {
  return backendApi.get<VendorPosition[]>("/tracking/positions/latest?limit=100");
}

export async function fetchVendorProfiles(): Promise<VendorProfile[]> {
  const data = await backendApi.get<
    Array<{ id: string; full_name: string | null; role_title: string | null }>
  >("/tracking/vendors");
  return data.map((profile) => ({
    user_id: profile.id,
    full_name: profile.full_name,
    role_title: profile.role_title,
  }));
}

export async function fetchVendorRouteHistory(
  vendorId: string,
  date: string
): Promise<VendorRouteHistory> {
  const allRows = await backendApi.get<VendorPosition[]>(
    `/tracking/history?vendorId=${vendorId}&date=${date}`,
  );

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
