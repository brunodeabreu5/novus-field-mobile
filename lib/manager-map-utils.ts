import type { VendorPosition } from "./data/types";
import type { TrackPoint } from "./tracking-history";

export function sortVendorPositionsByRecordedAtDesc(rows: VendorPosition[]): VendorPosition[] {
  return [...rows].sort(
    (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
  );
}

export function buildTrackPointsFromVendorPositions(rows: VendorPosition[]): TrackPoint[] {
  return [...rows]
    .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
    .map((row) => ({
      lat: row.latitude,
      lng: row.longitude,
      accuracy: row.accuracy_meters ?? 0,
      speedKmh: row.speed_kmh ?? 0,
      heading: row.heading ?? null,
      isIdle: row.is_idle ?? false,
      idleDurationSec: row.idle_duration_seconds ?? 0,
      timestamp: new Date(row.recorded_at),
    }));
}
