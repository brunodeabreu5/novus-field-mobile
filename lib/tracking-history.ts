export interface TrackPoint {
  lat: number;
  lng: number;
  accuracy: number;
  speedKmh: number;
  heading: number | null;
  isIdle: boolean;
  idleDurationSec: number;
  timestamp: Date;
}

export interface VendorTrackingStats {
  totalDistanceKm: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  totalIdleTimeSec: number;
  idleStops: { lat: number; lng: number; durationSec: number; startTime: Date }[];
  elapsedTimeSec: number;
}

function haversineDistanceMeters(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusM = 6_371_000;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) *
      Math.cos(toRad(to.lat)) *
      Math.sin(dLng / 2) ** 2;

  return 2 * earthRadiusM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function computeTrackingStats(
  points: TrackPoint[],
  idleThresholdSec = 120
): VendorTrackingStats {
  if (points.length === 0) {
    return {
      totalDistanceKm: 0,
      avgSpeedKmh: 0,
      maxSpeedKmh: 0,
      totalIdleTimeSec: 0,
      idleStops: [],
      elapsedTimeSec: 0,
    };
  }

  let totalDist = 0;
  let maxSpeed = 0;
  let totalIdle = 0;
  const idleStops: VendorTrackingStats["idleStops"] = [];
  let currentIdleStart: Date | null = null;
  let currentIdleLat = 0;
  let currentIdleLng = 0;

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    if (index > 0) {
      const prev = points[index - 1];
      totalDist += haversineDistanceMeters(
        { lat: prev.lat, lng: prev.lng },
        { lat: point.lat, lng: point.lng }
      );
    }

    if (point.speedKmh > maxSpeed) {
      maxSpeed = point.speedKmh;
    }

    if (point.isIdle) {
      if (!currentIdleStart) {
        currentIdleStart = point.timestamp;
        currentIdleLat = point.lat;
        currentIdleLng = point.lng;
      }
      totalIdle += point.idleDurationSec;
    } else if (currentIdleStart) {
      const durationSec =
        (point.timestamp.getTime() - currentIdleStart.getTime()) / 1000;
      if (durationSec >= idleThresholdSec) {
        idleStops.push({
          lat: currentIdleLat,
          lng: currentIdleLng,
          durationSec: Math.round(durationSec),
          startTime: currentIdleStart,
        });
      }
      currentIdleStart = null;
    }
  }

  if (currentIdleStart && points.length > 0) {
    const lastPoint = points[points.length - 1];
    const durationSec =
      (lastPoint.timestamp.getTime() - currentIdleStart.getTime()) / 1000;
    if (durationSec >= idleThresholdSec) {
      idleStops.push({
        lat: currentIdleLat,
        lng: currentIdleLng,
        durationSec: Math.round(durationSec),
        startTime: currentIdleStart,
      });
    }
  }

  const elapsedSec =
    points.length > 1
      ? (points[points.length - 1].timestamp.getTime() -
          points[0].timestamp.getTime()) /
        1000
      : 0;
  const movingTimeSec = Math.max(elapsedSec - totalIdle, 1);
  const totalDistKm = totalDist / 1000;

  return {
    totalDistanceKm: Math.round(totalDistKm * 100) / 100,
    avgSpeedKmh:
      Math.round((totalDistKm / (movingTimeSec / 3600)) * 10) / 10 || 0,
    maxSpeedKmh: Math.round(maxSpeed * 10) / 10,
    totalIdleTimeSec: Math.round(totalIdle),
    idleStops,
    elapsedTimeSec: Math.round(elapsedSec),
  };
}
