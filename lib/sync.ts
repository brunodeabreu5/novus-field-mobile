import { supabase } from "./supabase";
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
  const { data, error } = await supabase
    .from("visit_type_options")
    .select("name")
    .eq("active", true)
    .eq("is_default", true)
    .maybeSingle();

  if (error) {
    console.warn("[Sync] Failed to load default visit type:", error.message);
    return "Comercial";
  }

  return data?.name || "Comercial";
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
  const { data, error } = await supabase
    .from("visits")
    .select("id")
    .eq("id", visitId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function fetchClient(clientId: string) {
  const { data, error } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function fetchCharge(chargeId: string) {
  const { data, error } = await supabase
    .from("charges")
    .select("id")
    .eq("id", chargeId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function fetchChatMessage(messageId: string) {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id")
    .eq("id", messageId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function syncCheckIn(action: CheckInAction): Promise<boolean> {
  const { payload } = action;
  const existing = await fetchVisit(payload.visitId);

  if (existing) {
    return true;
  }

  const defaultVisitType = await fetchDefaultVisitTypeName();

  const { error } = await supabase.from("visits").insert({
    id: payload.visitId,
    vendor_id: payload.vendorId,
    vendor_name: payload.vendorName,
    client_id: payload.zoneId,
    client_name: payload.clientName,
    check_in_at: payload.timestamp,
    check_in_lat: payload.position.lat,
    check_in_lng: payload.position.lng,
    auto_checked_in: true,
    visit_type: defaultVisitType,
  });

  if (error) {
    throw new Error(error.message);
  }

  return true;
}

async function syncCheckOut(action: CheckOutAction): Promise<boolean> {
  const { payload } = action;
  const existing = await fetchVisit(payload.visitId);

  if (!existing) {
    console.warn("[Sync] Visit not found for check_out:", payload.visitId);
    return false;
  }

  const { error } = await supabase
    .from("visits")
    .update({
      check_out_at: payload.timestamp,
      check_out_lat: payload.position.lat,
      check_out_lng: payload.position.lng,
    })
    .eq("id", payload.visitId);

  if (error) {
    throw new Error(error.message);
  }

  return true;
}

async function syncVisitCreate(action: VisitCreateAction): Promise<boolean> {
  const { payload } = action;
  const existing = await fetchVisit(payload.visitId);

  if (existing) {
    return true;
  }

  const defaultVisitType = await fetchDefaultVisitTypeName();

  const { error } = await supabase.from("visits").insert({
    id: payload.visitId,
    vendor_id: payload.vendorId,
    vendor_name: payload.vendorName,
    client_id: payload.zoneId,
    client_name: payload.clientName,
    check_in_at: payload.timestamp,
    check_in_lat: payload.position.lat,
    check_in_lng: payload.position.lng,
    auto_checked_in: true,
    visit_type: defaultVisitType,
  });

  if (error) {
    throw new Error(error.message);
  }

  return true;
}

async function syncManualVisitCreate(action: ManualVisitCreateAction): Promise<boolean> {
  const { payload } = action;
  const existing = await fetchVisit(payload.visitId);

  if (existing) {
    return true;
  }

  const { error } = await supabase.from("visits").insert({
    id: payload.visitId,
    vendor_id: payload.vendorId,
    vendor_name: payload.vendorName,
    client_id: payload.clientId,
    client_name: payload.clientName,
    notes: payload.notes,
    visit_type: payload.visitType ?? undefined,
    check_in_at: payload.timestamp,
  });

  if (error) {
    throw new Error(error.message);
  }

  return true;
}

async function syncClientCreate(action: ClientCreateAction): Promise<boolean> {
  const { payload } = action;
  const existing = await fetchClient(payload.clientId);

  if (existing) {
    return true;
  }

  const { error } = await supabase.from("clients").insert({
    id: payload.clientId,
    created_by: payload.userId,
    name: payload.name,
    document: payload.document,
    phone: payload.phone,
    email: payload.email,
    address: payload.address,
    notes: payload.notes,
    latitude: payload.latitude,
    longitude: payload.longitude,
  });

  if (error) {
    throw new Error(error.message);
  }

  return true;
}

async function syncChargeCreate(action: ChargeCreateAction): Promise<boolean> {
  const { payload } = action;
  const existing = await fetchCharge(payload.chargeId);

  if (existing) {
    return true;
  }

  const { error } = await supabase.from("charges").insert({
    id: payload.chargeId,
    vendor_id: payload.userId,
    vendor_name: payload.vendorName,
    created_by: payload.userId,
    client_id: payload.clientId,
    client_name: payload.clientName,
    amount: payload.amount,
    currency: "PYG",
    due_date: payload.dueDate,
    notes: payload.notes,
    status: "pendiente",
  });

  if (error) {
    throw new Error(error.message);
  }

  return true;
}

async function syncChatSend(action: ChatSendAction): Promise<boolean> {
  const { payload } = action;
  const existing = await fetchChatMessage(payload.messageId);

  if (existing) {
    return true;
  }

  const { error } = await supabase.from("chat_messages").insert({
    id: payload.messageId,
    sender_id: payload.senderId,
    receiver_id: payload.receiverId,
    message: payload.message,
    read: false,
    created_at: payload.createdAt,
  });

  if (error) {
    throw new Error(error.message);
  }

  return true;
}

async function syncVendorPosition(action: VendorPositionAction): Promise<boolean> {
  const { payload } = action;
  const { error } = await supabase.from("vendor_positions").insert({
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

  if (error) {
    throw new Error(error.message);
  }

  return true;
}
