import AsyncStorage from "@react-native-async-storage/async-storage";
import { logger } from "./logger";

const TRACKING_DIAGNOSTICS_KEY = "novus_tracking_diagnostics";
const MAX_DELIVERY_LOG_ENTRIES = 50;

export interface TrackingDeliveryLog {
  timestamp: number;
  intervalMs: number | null;
  locationCount: number;
  wasFallback: boolean;
  vendorId: string;
}

export interface TrackingDiagnostics {
  lastDeliveryAt: number | null;
  totalDeliveries: number;
  totalFallbacks: number;
  avgIntervalMs: number | null;
  lastHeartbeatAt: number | null;
  lastHeartbeatMode: string | null;
  lastPositionSentAt: number | null;
  lastPositionRecordedAt: number | null;
  lastPositionSource: string | null;
  recentDeliveries: TrackingDeliveryLog[];
  lastErrorAt: number | null;
  lastErrorMessage: string | null;
}

const DEFAULT_DIAGNOSTICS: TrackingDiagnostics = {
  lastDeliveryAt: null,
  totalDeliveries: 0,
  totalFallbacks: 0,
  avgIntervalMs: null,
  lastHeartbeatAt: null,
  lastHeartbeatMode: null,
  lastPositionSentAt: null,
  lastPositionRecordedAt: null,
  lastPositionSource: null,
  recentDeliveries: [],
  lastErrorAt: null,
  lastErrorMessage: null,
};

export async function loadTrackingDiagnostics(): Promise<TrackingDiagnostics> {
  try {
    const raw = await AsyncStorage.getItem(TRACKING_DIAGNOSTICS_KEY);
    if (!raw) return { ...DEFAULT_DIAGNOSTICS };
    const parsed = JSON.parse(raw) as TrackingDiagnostics;
    return {
      ...DEFAULT_DIAGNOSTICS,
      ...parsed,
      recentDeliveries: Array.isArray(parsed.recentDeliveries)
        ? parsed.recentDeliveries
        : [],
    };
  } catch {
    return { ...DEFAULT_DIAGNOSTICS };
  }
}

async function saveTrackingDiagnostics(diagnostics: TrackingDiagnostics) {
  try {
    await AsyncStorage.setItem(
      TRACKING_DIAGNOSTICS_KEY,
      JSON.stringify(diagnostics),
    );
  } catch (saveError) {
    logger.warn(
      "TrackingDiagnostics",
      "Failed to save diagnostics:",
      saveError instanceof Error ? saveError.message : saveError,
    );
  }
}

export async function recordBackgroundDelivery(options: {
  vendorId: string;
  locationCount: number;
  wasFallback: boolean;
}) {
  try {
    const diagnostics = await loadTrackingDiagnostics();
    const now = Date.now();

    const intervalMs =
      diagnostics.lastDeliveryAt && diagnostics.lastDeliveryAt > 0
        ? now - diagnostics.lastDeliveryAt
        : null;

    const entry: TrackingDeliveryLog = {
      timestamp: now,
      intervalMs,
      locationCount: options.locationCount,
      wasFallback: options.wasFallback,
      vendorId: options.vendorId,
    };

    diagnostics.lastDeliveryAt = now;
    diagnostics.totalDeliveries += 1;
    if (options.wasFallback) {
      diagnostics.totalFallbacks += 1;
    }

    diagnostics.recentDeliveries.unshift(entry);
    if (diagnostics.recentDeliveries.length > MAX_DELIVERY_LOG_ENTRIES) {
      diagnostics.recentDeliveries.pop();
    }

    // Recalculate average interval from recent deliveries
    const intervals = diagnostics.recentDeliveries
      .map((d) => d.intervalMs)
      .filter((i): i is number => i !== null);

    diagnostics.avgIntervalMs =
      intervals.length > 0
        ? Math.round(
            intervals.reduce((a, b) => a + b, 0) / intervals.length,
          )
        : null;

    await saveTrackingDiagnostics(diagnostics);

    logger.debug(
      "TrackingDiagnostics",
      `Background delivery recorded: count=${options.locationCount}, fallback=${options.wasFallback}, interval=${intervalMs ?? "first"}ms`,
    );
  } catch (error) {
    logger.warn(
      "TrackingDiagnostics",
      "Failed to record delivery:",
      error instanceof Error ? error.message : error,
    );
  }
}

export async function recordBackgroundError(message: string) {
  try {
    const diagnostics = await loadTrackingDiagnostics();
    diagnostics.lastErrorAt = Date.now();
    diagnostics.lastErrorMessage = message;
    await saveTrackingDiagnostics(diagnostics);
  } catch {
    // Silent fail — diagnostics should never break tracking
  }
}

export async function recordTrackingHeartbeat(options: {
  trackingMode: string;
}) {
  try {
    const diagnostics = await loadTrackingDiagnostics();
    diagnostics.lastHeartbeatAt = Date.now();
    diagnostics.lastHeartbeatMode = options.trackingMode;
    await saveTrackingDiagnostics(diagnostics);
  } catch {
    // Silent fail — diagnostics should never break tracking
  }
}

export async function recordTrackingPosition(options: {
  recordedAt: string;
  source: string;
}) {
  try {
    const diagnostics = await loadTrackingDiagnostics();
    diagnostics.lastPositionSentAt = Date.now();
    const parsedRecordedAt = new Date(options.recordedAt).getTime();
    diagnostics.lastPositionRecordedAt = Number.isFinite(parsedRecordedAt)
      ? parsedRecordedAt
      : null;
    diagnostics.lastPositionSource = options.source;
    await saveTrackingDiagnostics(diagnostics);
  } catch {
    // Silent fail — diagnostics should never break tracking
  }
}

export async function clearTrackingDiagnostics() {
  try {
    await AsyncStorage.removeItem(TRACKING_DIAGNOSTICS_KEY);
  } catch {
    // Ignore
  }
}
