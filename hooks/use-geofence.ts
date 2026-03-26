import { useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { logger } from "../lib/logger";

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

const GEOFENCE_ZONES_KEY = "novus_geofence_zones";
const GEOFENCE_ACTIVE_VISITS_KEY = "novus_geofence_active_visits";
const GEOFENCE_INSIDE_ZONES_KEY = "novus_geofence_inside_zones";
const GEOFENCE_VENDOR_NAME_KEY = "novus_geofence_vendor_name";

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
    logger.warn(logLabel, "Failed to enqueue action", enqueueError);
  }
}

async function saveGeofenceZones(zones: GeofenceZone[]) {
  await AsyncStorage.setItem(GEOFENCE_ZONES_KEY, JSON.stringify(zones));
}

async function loadGeofenceZones(): Promise<GeofenceZone[]> {
  try {
    const raw = await AsyncStorage.getItem(GEOFENCE_ZONES_KEY);
    return raw ? (JSON.parse(raw) as GeofenceZone[]) : [];
  } catch {
    return [];
  }
}

async function saveInsideZones(zoneIds: Set<string>) {
  await AsyncStorage.setItem(GEOFENCE_INSIDE_ZONES_KEY, JSON.stringify(Array.from(zoneIds)));
}

async function loadInsideZones(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(GEOFENCE_INSIDE_ZONES_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

async function saveActiveVisits(visits: Map<string, VisitCheckIn>) {
  await AsyncStorage.setItem(
    GEOFENCE_ACTIVE_VISITS_KEY,
    JSON.stringify(Array.from(visits.entries())),
  );
}

async function loadActiveVisits(): Promise<Map<string, VisitCheckIn>> {
  try {
    const raw = await AsyncStorage.getItem(GEOFENCE_ACTIVE_VISITS_KEY);
    if (!raw) return new Map();

    const entries = JSON.parse(raw) as Array<[string, VisitCheckIn]>;
    return new Map(
      entries.map(([key, value]) => [
        key,
        {
          ...value,
          checkInTime: new Date(value.checkInTime),
          checkOutTime: value.checkOutTime ? new Date(value.checkOutTime) : null,
        },
      ]),
    );
  } catch {
    return new Map();
  }
}

async function saveVendorName(vendorName: string | null | undefined) {
  if (!vendorName) {
    await AsyncStorage.removeItem(GEOFENCE_VENDOR_NAME_KEY);
    return;
  }

  await AsyncStorage.setItem(GEOFENCE_VENDOR_NAME_KEY, vendorName);
}

export async function getStoredGeofenceVendorName() {
  return AsyncStorage.getItem(GEOFENCE_VENDOR_NAME_KEY);
}

async function persistGeofenceRuntimeState(options: {
  zones?: GeofenceZone[];
  insideZones: Set<string>;
  activeVisits: Map<string, VisitCheckIn>;
}) {
  if (options.zones) {
    await saveGeofenceZones(options.zones);
  }
  await Promise.all([
    saveInsideZones(options.insideZones),
    saveActiveVisits(options.activeVisits),
  ]);
}

async function clearGeofenceRuntimeState() {
  await Promise.all([
    AsyncStorage.removeItem(GEOFENCE_ZONES_KEY),
    AsyncStorage.removeItem(GEOFENCE_ACTIVE_VISITS_KEY),
    AsyncStorage.removeItem(GEOFENCE_INSIDE_ZONES_KEY),
    AsyncStorage.removeItem(GEOFENCE_VENDOR_NAME_KEY),
  ]);
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

async function processGeofencePosition(options: {
  position: GeoPosition;
  zones: GeofenceZone[];
  autoCheckIn: boolean;
  vendorId: string | null | undefined;
  vendorName: string | null | undefined;
  insideZones: Set<string>;
  activeVisits: Map<string, VisitCheckIn>;
}) {
  const nowInside = new Set<string>();
  const nextActive = new Map(options.activeVisits);
  const insideZonesRef = { current: options.insideZones };

  for (const zone of options.zones) {
    await processGeofenceZone({
      zone,
      position: options.position,
      autoCheckIn: options.autoCheckIn,
      vendorId: options.vendorId,
      vendorName: options.vendorName,
      nowInside,
      nextActive,
      insideZonesRef,
    });
  }

  return {
    insideZones: nowInside,
    activeVisits: nextActive,
  };
}

export async function processGeofencePositionInBackground(options: {
  position: GeoPosition;
  vendorId: string | null | undefined;
  vendorName?: string | null;
  autoCheckIn?: boolean;
}) {
  if (!options.vendorId) {
    return;
  }

  const zones = await loadGeofenceZones();
  if (zones.length === 0) {
    return;
  }

  const [insideZones, activeVisits, storedVendorName] = await Promise.all([
    loadInsideZones(),
    loadActiveVisits(),
    getStoredGeofenceVendorName(),
  ]);

  const result = await processGeofencePosition({
    position: options.position,
    zones,
    autoCheckIn: options.autoCheckIn ?? true,
    vendorId: options.vendorId,
    vendorName: options.vendorName ?? storedVendorName,
    insideZones,
    activeVisits,
  });

  await persistGeofenceRuntimeState({
    insideZones: result.insideZones,
    activeVisits: result.activeVisits,
  });
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
    if (enabled && vendorId) {
      return;
    }

    insideZonesRef.current = new Set();
    activeVisitsRef.current = new Map();
    setActiveVisits([]);
    setZones([]);
    void clearGeofenceRuntimeState();
  }, [enabled, vendorId]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [storedInsideZones, storedActiveVisits] = await Promise.all([
        loadInsideZones(),
        loadActiveVisits(),
      ]);

      if (cancelled) {
        return;
      }

      insideZonesRef.current = storedInsideZones;
      activeVisitsRef.current = storedActiveVisits;
      setActiveVisits(Array.from(storedActiveVisits.values()));
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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
        await saveGeofenceZones(zonesWithCenter);
      } catch (loadError) {
        logger.warn("Geofence", "Failed to load zones from backend", loadError);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load geofence zones",
        );
      }
    })();
  }, [enabled, vendorId]);

  useEffect(() => {
    void saveVendorName(enabled && vendorId ? vendorName : null);
  }, [enabled, vendorId, vendorName]);

  useEffect(() => {
    if (!enabled || zones.length === 0) return;

    let interval: ReturnType<typeof setInterval>;
    let cancelled = false;

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

      const result = await processGeofencePosition({
        position,
        zones,
        autoCheckIn,
        vendorId,
        vendorName,
        insideZones: insideZonesRef.current,
        activeVisits: activeVisitsRef.current,
      });

      insideZonesRef.current = result.insideZones;
      activeVisitsRef.current = result.activeVisits;

      if (!cancelled) {
        setActiveVisits(Array.from(result.activeVisits.values()));
      }

      await persistGeofenceRuntimeState({
        zones,
        insideZones: result.insideZones,
        activeVisits: result.activeVisits,
      });
    };

    void run();
    interval = setInterval(run, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
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
            logger.warn("Geofence", "Failed to enqueue manual check-out", enqueueError);
          });
      }
    },
    [currentPosition]
  );

  return { activeVisits, currentPosition, error, manualCheckOut };
}
