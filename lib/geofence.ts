export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface GeoPosition extends GeoPoint {
  accuracy: number;
}

export interface GeofenceZone {
  id: string;
  name: string;
  center: GeoPoint;
  radiusMeters: number;
  minRadiusMeters?: number;
  maxRadiusMeters?: number;
  clientName?: string;
}

export type AlertSeverity = "info" | "warning" | "critical";

export interface GeofenceAlert {
  id: string;
  zone: GeofenceZone;
  type: "enter" | "exit";
  severity: AlertSeverity;
  timestamp: Date;
  distance: number;
  accuracy: number;
  effectiveRadius: number;
}

export const getAlertSeverity = (
  distance: number,
  effectiveRadius: number,
  type: "enter" | "exit"
): AlertSeverity => {
  const ratio = distance / effectiveRadius;
  if (type === "enter") {
    if (ratio < 0.3) return "critical";
    if (ratio < 0.7) return "warning";
    return "info";
  }
  if (ratio > 1.5) return "critical";
  if (ratio > 1.2) return "warning";
  return "info";
};

export const haversineDistance = (a: GeoPoint, b: GeoPoint): number => {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;

  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

export const getAdaptiveRadius = (
  zone: GeofenceZone,
  accuracy: number,
  mode: "enter" | "exit" = "enter"
): number => {
  const minR = zone.minRadiusMeters ?? zone.radiusMeters * 0.5;
  const maxR = zone.maxRadiusMeters ?? zone.radiusMeters * 2;

  let effective = zone.radiusMeters + Math.min(accuracy * 0.5, zone.radiusMeters);

  if (mode === "exit") {
    effective *= 1.2;
  }

  return Math.max(minR, Math.min(effective, maxR));
};
