import { useState, useEffect, useCallback, useRef } from "react";
import * as Location from "expo-location";
import { supabase } from "../lib/supabase";
import {
  GeoPosition,
  GeofenceZone,
  haversineDistance,
  getAdaptiveRadius,
} from "../lib/geofence";
import { offlineStorage } from "../lib/offline-storage";
import { generateId } from "../lib/ids";

export interface VisitCheckIn {
  id: string;
  zoneId: string;
  clientName: string;
  checkInTime: Date;
  checkOutTime: Date | null;
  autoCheckedIn: boolean;
}

interface UseGeofenceOptions {
  enabled: boolean;
  vendorId?: string | null;
  vendorName?: string | null;
  intervalMs?: number;
  autoCheckIn?: boolean;
}

export function useGeofence(options: UseGeofenceOptions) {
  const {
    enabled,
    vendorId,
    vendorName,
    intervalMs = 5000,
    autoCheckIn = true,
  } = options;

  const [zones, setZones] = useState<GeofenceZone[]>([]);
  const [activeVisits, setActiveVisits] = useState<VisitCheckIn[]>([]);
  const [currentPosition, setCurrentPosition] = useState<GeoPosition | null>(null);
  const [error, setError] = useState<string | null>(null);

  const insideZonesRef = useRef<Set<string>>(new Set());
  const activeVisitsRef = useRef<Map<string, VisitCheckIn>>(new Map());

  useEffect(() => {
    if (!enabled || !vendorId) return;

    (async () => {
      const { data: configData } = await supabase
        .from("geofence_alert_configs")
        .select("id, zone_id, zone_name, client_name, custom_radius_meters")
        .eq("enabled", true);

      if (!configData || configData.length === 0) return;

      const zoneIds = configData.map((c) => c.zone_id).filter(Boolean);
      const { data: clientData } = await supabase
        .from("clients")
        .select("id, latitude, longitude")
        .in("id", zoneIds);

      const clientMap = new Map(
        (clientData || []).map(
          (c: { id: string; latitude?: number | null; longitude?: number | null }) => [
            c.id,
            c,
          ]
        )
      );

      const zonesWithCenter: GeofenceZone[] = configData
        .map((c) => {
          const client = clientMap.get(c.zone_id);
          const lat = client?.latitude;
          const lng = client?.longitude;

          if (lat == null || lng == null || lat === 0 || lng === 0) {
            console.warn(`[Geofence] Zone ${c.zone_id} has invalid coordinates`);
            return null;
          }

          return {
            id: c.zone_id,
            name: c.zone_name,
            clientName: c.client_name ?? c.zone_name ?? "Cliente",
            center: { lat, lng },
            radiusMeters: c.custom_radius_meters || 50,
          } as GeofenceZone;
        })
        .filter((z): z is GeofenceZone => z !== null);

      setZones(zonesWithCenter);
    })();
  }, [enabled, vendorId]);

  useEffect(() => {
    if (!enabled || zones.length === 0) return;

    let interval: ReturnType<typeof setInterval>;

    const run = async () => {
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const position: GeoPosition = {
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          accuracy: loc.coords.accuracy ?? 20,
        };

        setCurrentPosition(position);

        const nowInside = new Set<string>();
        const nextActive = new Map(activeVisitsRef.current);

        zones.forEach((zone) => {
          const distance = haversineDistance(position, zone.center);
          const wasInside = insideZonesRef.current.has(zone.id);
          const enterRadius = getAdaptiveRadius(zone, position.accuracy, "enter");
          const exitRadius = getAdaptiveRadius(zone, position.accuracy, "exit");
          const isInside = wasInside
            ? distance <= exitRadius
            : distance <= enterRadius;

          if (isInside) nowInside.add(zone.id);

          if (isInside && !wasInside && autoCheckIn && vendorId && vendorName) {
            const visit: VisitCheckIn = {
              id: generateId(),
              zoneId: zone.id,
              clientName: zone.clientName || zone.name,
              checkInTime: new Date(),
              checkOutTime: null,
              autoCheckedIn: true,
            };
            nextActive.set(zone.id, visit);
            offlineStorage.enqueue({
              type: "check_in",
              payload: {
                visitId: visit.id,
                zoneId: zone.id,
                clientName: visit.clientName,
                vendorId,
                vendorName,
                position,
                timestamp: visit.checkInTime.toISOString(),
              },
            });
          } else if (!isInside && wasInside) {
            const current = nextActive.get(zone.id);
            if (current) {
              const completed = {
                ...current,
                checkOutTime: new Date(),
              };
              nextActive.delete(zone.id);
              offlineStorage.enqueue({
                type: "check_out",
                payload: {
                  visitId: completed.id,
                  zoneId: zone.id,
                  position,
                  timestamp: completed.checkOutTime!.toISOString(),
                },
              });
            }
          }
        });

        insideZonesRef.current = nowInside;
        activeVisitsRef.current = nextActive;
        setActiveVisits(Array.from(nextActive.values()));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Location error");
      }
    };

    run();
    interval = setInterval(run, intervalMs);
    return () => clearInterval(interval);
  }, [enabled, zones, vendorId, vendorName, autoCheckIn, intervalMs]);

  const manualCheckOut = useCallback(
    (zoneId: string) => {
      const current = activeVisitsRef.current.get(zoneId);
      if (current && currentPosition) {
        const completed = {
          ...current,
          checkOutTime: new Date(),
        };
        activeVisitsRef.current.delete(zoneId);
        setActiveVisits(Array.from(activeVisitsRef.current.values()));
        offlineStorage.enqueue({
          type: "check_out",
          payload: {
            visitId: completed.id,
            zoneId,
            position: currentPosition,
            timestamp: completed.checkOutTime!.toISOString(),
          },
        });
      }
    },
    [currentPosition]
  );

  return { activeVisits, currentPosition, error, manualCheckOut };
}
