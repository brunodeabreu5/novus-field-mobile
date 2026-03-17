import { backendApi } from "./backend-api";
import {
  type ChargeCreateAction,
  type ChatSendAction,
  type ClientCreateAction,
  offlineStorage,
  type CheckInAction,
  type CheckOutAction,
  type ManualVisitCreateAction,
  type QueuedAction,
  type VendorPositionAction,
  type VisitCreateAction,
} from "./offline-storage";

async function fetchDefaultVisitTypeName() {
  try {
    const data = await backendApi.get<Array<{ name: string; is_default: boolean }>>(
      "/visit-types?activeOnly=true",
    );
    const defaultItem = data.find((item) => item.is_default);
    if (defaultItem?.name) {
      return defaultItem.name;
    }
  } catch (error) {
    console.warn(
      "[Sync] Failed to load default visit type:",
      error instanceof Error ? error.message : String(error),
    );
  }

  try {
    const data = await backendApi.get<Array<{ name: string }>>("/visit-types");
    if (data[0]?.name) {
      return data[0].name;
    }
  } catch {
    return "Comercial";
  }
  return "Comercial";
}

export async function syncQueuedActions(): Promise<number> {
  const queue = await offlineStorage.getQueue();
  if (queue.length === 0) return 0;

  let synced = 0;
  const errors: string[] = [];

  for (const action of queue) {
    try {
      const wasSynced = await syncAction(action);
      if (!wasSynced) {
        await offlineStorage.incrementRetries(action.id);
        continue;
      }

      await offlineStorage.removeFromQueue(action.id);
      synced++;
    } catch (err) {
      await offlineStorage.incrementRetries(action.id);
      errors.push(`${action.type}: ${err instanceof Error ? err.message : err}`);
    }
  }

  if (errors.length > 0) {
    console.warn("[Sync] Errors:", errors);
  }

  return synced;
}

export function isOfflineLikeError(error: unknown): boolean {
  if (!error) return false;

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : typeof error === "object" && error && "message" in error
          ? String(error.message)
          : "";

  if (!message) return false;

  const normalized = message.toLowerCase();
  return (
    normalized.includes("failed to fetch") ||
    normalized.includes("network request failed") ||
    normalized.includes("network error") ||
    normalized.includes("fetch failed") ||
    normalized.includes("offline")
  );
}

async function syncAction(action: QueuedAction): Promise<boolean> {
  switch (action.type) {
    case "check_in":
      return syncCheckIn(action);
    case "check_out":
      return syncCheckOut(action);
    case "visit_create":
      return syncVisitCreate(action);
    case "manual_visit_create":
      return syncManualVisitCreate(action);
    case "client_create":
      return syncClientCreate(action);
    case "charge_create":
      return syncChargeCreate(action);
    case "chat_send":
      return syncChatSend(action);
    case "vendor_position":
      return syncVendorPosition(action);
    default:
      return false;
  }
}

async function fetchVisit(visitId: string) {
  try {
    return await backendApi.get<{ id: string }>(`/visits/${visitId}`);
  } catch (error) {
    if (error instanceof Error && error.message.includes("404")) {
      return null;
    }
    if (error instanceof Error && error.message.includes("not found")) {
      return null;
    }
    throw error;
  }
}

async function fetchClient(clientId: string) {
  try {
    return await backendApi.get<{ id: string }>(`/clients/${clientId}`);
  } catch (error) {
    if (error instanceof Error && error.message.includes("404")) {
      return null;
    }
    if (error instanceof Error && error.message.includes("not found")) {
      return null;
    }
    throw error;
  }
}

async function fetchCharge(chargeId: string) {
  try {
    return await backendApi.get<{ id: string }>(`/charges/${chargeId}`);
  } catch (error) {
    if (error instanceof Error && error.message.includes("404")) {
      return null;
    }
    if (error instanceof Error && error.message.includes("not found")) {
      return null;
    }
    throw error;
  }
}

async function fetchChatMessage(messageId: string, otherUserId: string) {
  try {
    const messages = await backendApi.get<Array<{ id: string }>>(
      `/chat/messages?otherUserId=${encodeURIComponent(otherUserId)}`,
    );
    const known = messages.find((message) => message.id === messageId);
    return known ?? null;
  } catch {
    return null;
  }
}

async function syncCheckIn(action: CheckInAction): Promise<boolean> {
  const { payload } = action;
  const existing = await fetchVisit(payload.visitId);

  if (existing) {
    return true;
  }

  const defaultVisitType = await fetchDefaultVisitTypeName();

  await backendApi.post("/visits", {
    client_id: payload.zoneId,
    client_name: payload.clientName,
    check_in_at: payload.timestamp,
    check_in_lat: payload.position.lat,
    check_in_lng: payload.position.lng,
    visit_type: defaultVisitType,
  });

  return true;
}

async function syncCheckOut(action: CheckOutAction): Promise<boolean> {
  const { payload } = action;
  const existing = await fetchVisit(payload.visitId);

  if (!existing) {
    console.warn("[Sync] Visit not found for check_out:", payload.visitId);
    return false;
  }

  await backendApi.patch(`/visits/${payload.visitId}/checkout`, {
    check_out_at: payload.timestamp,
    check_out_lat: payload.position.lat,
    check_out_lng: payload.position.lng,
  });

  return true;
}

async function syncVisitCreate(action: VisitCreateAction): Promise<boolean> {
  const { payload } = action;
  const existing = await fetchVisit(payload.visitId);

  if (existing) {
    return true;
  }

  const defaultVisitType = await fetchDefaultVisitTypeName();

  await backendApi.post("/visits", {
    client_id: payload.zoneId,
    client_name: payload.clientName,
    check_in_at: payload.timestamp,
    check_in_lat: payload.position.lat,
    check_in_lng: payload.position.lng,
    visit_type: defaultVisitType,
  });

  return true;
}

async function syncManualVisitCreate(action: ManualVisitCreateAction): Promise<boolean> {
  const { payload } = action;
  const existing = await fetchVisit(payload.visitId);

  if (existing) {
    return true;
  }

  await backendApi.post("/visits", {
    client_id: payload.clientId,
    client_name: payload.clientName,
    notes: payload.notes,
    visit_type: payload.visitType ?? undefined,
    check_in_at: payload.timestamp,
  });

  return true;
}

async function syncClientCreate(action: ClientCreateAction): Promise<boolean> {
  const { payload } = action;
  const existing = await fetchClient(payload.clientId);

  if (existing) {
    return true;
  }

  await backendApi.post("/clients", {
    name: payload.name,
    document: payload.document,
    phone: payload.phone,
    email: payload.email,
    address: payload.address,
    notes: payload.notes,
    latitude: payload.latitude,
    longitude: payload.longitude,
  });

  return true;
}

async function syncChargeCreate(action: ChargeCreateAction): Promise<boolean> {
  const { payload } = action;
  const existing = await fetchCharge(payload.chargeId);

  if (existing) {
    return true;
  }

  await backendApi.post("/charges", {
    client_id: payload.clientId,
    client_name: payload.clientName,
    amount: payload.amount,
    currency: "PYG",
    due_date: payload.dueDate,
    notes: payload.notes,
    status: "pendiente",
  });

  return true;
}

async function syncChatSend(action: ChatSendAction): Promise<boolean> {
  const { payload } = action;
  const existing = await fetchChatMessage(payload.messageId, payload.receiverId);

  if (existing) {
    return true;
  }

  await backendApi.post("/chat/messages", {
    id: payload.messageId,
    sender_id: payload.senderId,
    receiver_id: payload.receiverId,
    message: payload.message,
    created_at: payload.createdAt,
  });

  return true;
}

async function syncVendorPosition(action: VendorPositionAction): Promise<boolean> {
  const { payload } = action;
  await backendApi.post("/tracking/positions", {
    vendor_id: payload.vendorId,
    latitude: payload.latitude,
    longitude: payload.longitude,
    accuracy_meters: payload.accuracyMeters,
    speed_kmh: payload.speedKmh,
    heading: payload.heading,
    idle_duration_seconds: null,
    is_idle: false,
    recorded_at: payload.recordedAt,
  });

  return true;
}
