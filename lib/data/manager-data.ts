import { backendApi } from "../backend-api";
import {
  buildTrackPointsFromVendorPositions,
  sortVendorPositionsByRecordedAtDesc,
} from "../manager-map-utils";
import { computeTrackingStats } from "../tracking-history";
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
  const rows = await backendApi.get<VendorPosition[]>("/tracking/positions/latest?limit=100");
  return sortVendorPositionsByRecordedAtDesc(rows);
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
  const trail = buildTrackPointsFromVendorPositions(allRows);

  return {
    trail,
    stats: computeTrackingStats(trail),
  };
}
