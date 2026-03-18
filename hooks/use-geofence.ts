import { useState, useEffect, useCallback, useRef } from "react";
import * as Location from "expo-location";
import { backendApi } from "../lib/backend-api";
import {
  GeoPosition,
  GeofenceZone,
  haversineDistance,
  getAdaptiveRadius,
} from "../lib/geofence";
import {
  offlineStorage,
  type CheckInPayload,
  type CheckOutPayload,
} from "../lib/offline-storage";
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

type MutableSetRef<T> = { current: Set<T> };

async function resolveCurrentPosition() {
  try {
    const lastKnown = await Location.getLastKnownPositionAsync({});
    if (lastKnown) {
      return lastKnown;
    }
  } catch {
    // Ignore and fall back to a fresh fix.
  }

  try {
    return await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
  } catch {
    return null;
  }
}

async function enqueueGeofenceAction(
  type: "check_in",
  payload: CheckInPayload,
  logLabel: string,
): Promise<void>;
async function enqueueGeofenceAction(
  type: "check_out",
  payload: CheckOutPayload,
  logLabel: string,
): Promise<void>;
async function enqueueGeofenceAction(
  type: "check_in" | "check_out",
  payload: CheckInPayload | CheckOutPayload,
  logLabel: string,
) {
  try {
    await offlineStorage.enqueue({ type, payload });
  } catch (enqueueError) {
    console.warn(
      logLabel,
      enqueueError instanceof Error ? enqueueError.message : enqueueError
    );
  }
}

async function processGeofenceZone(options: {
  zone: GeofenceZone;
  position: GeoPosition;
  autoCheckIn: boolean;
  vendorId: string | null | undefined;
  vendorName: string | null | undefined;
  nowInside: Set<string>;
  nextActive: Map<string, VisitCheckIn>;
  insideZonesRef: MutableSetRef<string>;
}): Promise<void> {
  const {
    zone,
    position,
    autoCheckIn,
    vendorId,
    vendorName,
    nowInside,
    nextActive,
    insideZonesRef,
  } = options;

  const distance = haversineDistance(position, zone.center);
  const wasInside = insideZonesRef.current.has(zone.id);
  const enterRadius = getAdaptiveRadius(zone, position.accuracy, "enter");
  const exitRadius = getAdaptiveRadius(zone, position.accuracy, "exit");
  const isInside = wasInside ? distance <= exitRadius : distance <= enterRadius;

  if (isInside) {
    nowInside.add(zone.id);
  }

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
    await enqueueGeofenceAction(
      "check_in",
      {
        visitId: visit.id,
        zoneId: zone.id,
        clientName: visit.clientName,
        vendorId,
        vendorName,
        position,
        timestamp: visit.checkInTime.toISOString(),
      },
      "[Geofence] Failed to enqueue auto check-in:",
    );
    return;
  }

  if (!isInside && wasInside) {
    const current = nextActive.get(zone.id);
    if (!current) {
      return;
    }

    const completed = {
      ...current,
      checkOutTime: new Date(),
    };
    nextActive.delete(zone.id);
    await enqueueGeofenceAction(
      "check_out",
      {
        visitId: completed.id,
        zoneId: zone.id,
        position,
        timestamp: completed.checkOutTime.toISOString(),
      },
      "[Geofence] Failed to enqueue auto check-out:",
    );
  }
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
      type GeofenceConfigRow = {
        id: string;
        zone_id: string;
        zone_name: string;
        client_name?: string | null;
        custom_radius_meters?: number | null;
        enabled?: boolean;
        assigned_vendor_ids?: string[];
      };

      type ClientRow = {
        id: string;
        latitude?: number | null;
        longitude?: number | null;
      };

      try {
        const [configData, clientData] = await Promise.all([
          backendApi.get<GeofenceConfigRow[]>("/geofence/configs"),
          backendApi.get<ClientRow[]>("/clients?order=name"),
        ]);

        const activeConfigs = configData.filter((config) => {
          if (!config.enabled) return false;
          const assignedVendorIds = config.assigned_vendor_ids ?? [];
          return assignedVendorIds.length === 0 || assignedVendorIds.includes(vendorId);
        });

        if (activeConfigs.length === 0) {
          setZones([]);
          return;
        }

        const clientMap = new Map(clientData.map((client) => [client.id, client]));

        const zonesWithCenter: GeofenceZone[] = [];
        for (const config of activeConfigs) {
          const client = clientMap.get(config.zone_id);
          const lat = client?.latitude;
          const lng = client?.longitude;

          if (lat == null || lng == null || lat === 0 || lng === 0) {
            console.warn(`[Geofence] Zone ${config.zone_id} has invalid coordinates`);
            continue;
          }

          zonesWithCenter.push({
            id: config.zone_id,
            name: config.zone_name,
            clientName: config.client_name || config.zone_name || "Cliente",
            center: { lat, lng },
            radiusMeters: config.custom_radius_meters || 50,
          });
        }

        setZones(zonesWithCenter);
      } catch (loadError) {
        console.warn("[Geofence] Failed to load zones from backend", loadError);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load geofence zones",
        );
      }
    })();
  }, [enabled, vendorId]);

  useEffect(() => {
    if (!enabled || zones.length === 0) return;

    let interval: ReturnType<typeof setInterval>;

    const run = async () => {
      const loc = await resolveCurrentPosition();
      if (!loc) {
        return;
      }

      const position: GeoPosition = {
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        accuracy: loc.coords.accuracy ?? 20,
      };

      setCurrentPosition(position);
      setError(null);

      const nowInside = new Set<string>();
      const nextActive = new Map(activeVisitsRef.current);

      for (const zone of zones) {
        await processGeofenceZone({
          zone,
          position,
          autoCheckIn,
          vendorId,
          vendorName,
          nowInside,
          nextActive,
          insideZonesRef,
        });
      }

      insideZonesRef.current = nowInside;
      activeVisitsRef.current = nextActive;
      setActiveVisits(Array.from(nextActive.values()));
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
        void offlineStorage
          .enqueue({
            type: "check_out",
            payload: {
              visitId: completed.id,
              zoneId,
              position: currentPosition,
              timestamp: completed.checkOutTime.toISOString(),
            },
          })
          .catch((enqueueError) => {
            console.warn(
              "[Geofence] Failed to enqueue manual check-out:",
              enqueueError instanceof Error ? enqueueError.message : enqueueError
            );
          });
      }
    },
    [currentPosition]
  );

  return { activeVisits, currentPosition, error, manualCheckOut };
}
