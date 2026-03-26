import { backendApi } from "./backend-api";
import { logger } from "./logger";
import {
  type ChargeCreateAction,
  type ChatSendAction,
  type ClientCreateAction,
  type ClientUpdateAction,
  offlineStorage,
  type CheckInAction,
  type CheckOutAction,
  type ManualVisitCreateAction,
  type QueuedChatAttachmentPayload,
  type QueuedAction,
  type QueuedVisitAttachmentPayload,
  type VendorPositionAction,
  type VisitAttachmentUploadAction,
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
    logger.warn(
      "Sync", "Failed to load default visit type:",
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
    logger.warn("Sync", "Errors:", errors);
  }

  return synced;
}

export function isOfflineLikeError(error: unknown): boolean {
  if (!error) return false;

  let message = "";
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "string") {
    message = error;
  } else if (typeof error === "object" && error && "message" in error) {
    message = String(error.message);
  }

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
  try {
    switch (action.type) {
      case "check_in":
        await syncCheckIn(action);
        return true;
      case "check_out":
        await syncCheckOut(action);
        return true;
      case "visit_create":
        await syncVisitCreate(action);
        return true;
      case "manual_visit_create":
        await syncManualVisitCreate(action);
        return true;
      case "client_create":
        await syncClientCreate(action);
        return true;
      case "client_update":
        await syncClientUpdate(action);
        return true;
      case "charge_create":
        await syncChargeCreate(action);
        return true;
      case "chat_send":
        await syncChatSend(action);
        return true;
      case "vendor_position":
        await syncVendorPosition(action);
        return true;
      case "visit_attachment_upload":
        await syncVisitAttachmentUpload(action);
        return true;
      default: {
        const exhaustiveCheck: never = action;
        throw new Error(`Unhandled sync action: ${String(exhaustiveCheck)}`);
      }
    }
  } catch (error) {
    if (error instanceof SyncNotFoundError) {
      return false;
    }

    throw error;
  }
}

async function fetchVisit(visitId: string) {
  const resolvedVisitId = await resolveRemoteVisitId(visitId);
  try {
    return await backendApi.get<{ id: string }>(`/visits/${resolvedVisitId}`);
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

async function resolveRemoteVisitId(visitId: string) {
  return (await offlineStorage.getVisitMapping(visitId)) ?? visitId;
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

class SyncNotFoundError extends Error {}

async function syncCheckIn(action: CheckInAction): Promise<void> {
  const { payload } = action;
  const existing = await fetchVisit(payload.visitId);

  if (existing) {
    return;
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
}

async function syncCheckOut(action: CheckOutAction): Promise<void> {
  const { payload } = action;
  const existing = await fetchVisit(payload.visitId);

  if (!existing) {
    logger.warn("Sync", "Visit not found for check_out:", payload.visitId);
    throw new SyncNotFoundError(payload.visitId);
  }

  const resolvedVisitId = await resolveRemoteVisitId(payload.visitId);
  await backendApi.patch(`/visits/${resolvedVisitId}/checkout`, {
    check_out_at: payload.timestamp,
    check_out_lat: payload.position.lat,
    check_out_lng: payload.position.lng,
  });
}

async function syncVisitCreate(action: VisitCreateAction): Promise<void> {
  const { payload } = action;
  const existing = await fetchVisit(payload.visitId);

  if (existing) {
    return;
  }

  const defaultVisitType = await fetchDefaultVisitTypeName();
  await postVisit({
    clientId: payload.zoneId,
    clientName: payload.clientName,
    timestamp: payload.timestamp,
    visitType: defaultVisitType,
    latitude: payload.position.lat,
    longitude: payload.position.lng,
  });
}

async function syncManualVisitCreate(action: ManualVisitCreateAction): Promise<void> {
  const { payload } = action;
  const existing = await fetchVisit(payload.visitId);

  if (existing) {
    return;
  }

  const created = await postVisit({
    clientId: payload.clientId,
    clientName: payload.clientName,
    timestamp: payload.timestamp,
    notes: payload.notes,
    visitType: payload.visitType ?? undefined,
  });

  if (created.id !== payload.visitId) {
    await offlineStorage.setVisitMapping(payload.visitId, created.id);
  }
}

async function syncClientCreate(action: ClientCreateAction): Promise<void> {
  const { payload } = action;
  const existing = await fetchClient(payload.clientId);

  if (existing) {
    return;
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
}

async function syncClientUpdate(action: ClientUpdateAction): Promise<void> {
  const { payload } = action;
  const existing = await fetchClient(payload.clientId);

  if (!existing) {
    logger.warn("Sync", "Client not found for update:", payload.clientId);
    throw new SyncNotFoundError(payload.clientId);
  }

  await backendApi.patch(`/clients/${payload.clientId}`, {
    name: payload.name,
    document: payload.document,
    phone: payload.phone,
    email: payload.email,
    address: payload.address,
    notes: payload.notes,
    latitude: payload.latitude,
    longitude: payload.longitude,
  });
}

async function syncChargeCreate(action: ChargeCreateAction): Promise<void> {
  const { payload } = action;
  const existing = await fetchCharge(payload.chargeId);

  if (existing) {
    return;
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
}

async function syncChatSend(action: ChatSendAction): Promise<void> {
  const { payload } = action;
  const existing = await fetchChatMessage(payload.messageId, payload.receiverId);

  if (existing) {
    return;
  }

  const attachments =
    payload.attachments.length > 0
      ? await Promise.all(payload.attachments.map(uploadChatAttachmentFromQueue))
      : [];

  await backendApi.post("/chat/messages", {
    id: payload.messageId,
    sender_id: payload.senderId,
    receiver_id: payload.receiverId,
    message: payload.message,
    created_at: payload.createdAt,
    attachments,
  });
}

async function syncVendorPosition(action: VendorPositionAction): Promise<void> {
  const { payload } = action;
  await backendApi.post("/tracking/positions", {
    vendor_id: payload.vendorId,
    latitude: payload.latitude,
    longitude: payload.longitude,
    accuracy_meters: payload.accuracyMeters,
    speed_kmh: payload.speedKmh,
    heading: payload.heading,
    idle_duration_seconds: payload.idleDurationSeconds,
    is_idle: payload.isIdle,
    recorded_at: payload.recordedAt,
  });
}

async function syncVisitAttachmentUpload(action: VisitAttachmentUploadAction): Promise<void> {
  const { payload } = action;
  const resolvedVisitId = await resolveRemoteVisitId(payload.visitId);
  const existing = await fetchVisit(resolvedVisitId);

  if (!existing) {
    logger.warn("Sync", "Visit not found for attachment upload:", payload.visitId);
    throw new SyncNotFoundError(payload.visitId);
  }

  const uploadTarget = await backendApi.post<{
    storage_path: string;
    upload_url: string;
  }>("/files/visit-attachments/presign-upload", {
    visit_id: resolvedVisitId,
    file_name: payload.fileName,
    mime_type: payload.mimeType,
    attachment_kind: payload.attachmentKind,
  });

  await uploadFileFromUri(payload.localUri, uploadTarget.upload_url, payload.mimeType);

  await backendApi.post(`/visits/${resolvedVisitId}/attachments`, {
    id: payload.attachmentId,
    storage_path: uploadTarget.storage_path,
    file_name: payload.fileName,
    mime_type: payload.mimeType,
    file_size_bytes: payload.fileSizeBytes,
    attachment_kind: payload.attachmentKind,
  });
}

async function uploadFileFromUri(
  fileUri: string,
  uploadUrl: string,
  mimeType?: string | null,
) {
  const response = await fetch(fileUri);
  const blob = await response.blob();
  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": mimeType || "application/octet-stream",
    },
    body: blob,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Upload failed: HTTP ${uploadResponse.status}`);
  }
}

async function uploadChatAttachmentFromQueue(attachment: QueuedChatAttachmentPayload) {
  const uploadTarget = await backendApi.post<{
    storage_path: string;
    upload_url: string;
  }>("/files/chat-attachments/presign-upload", {
    file_name: attachment.fileName,
    mime_type: attachment.mimeType,
  });

  await uploadFileFromUri(attachment.localUri, uploadTarget.upload_url, attachment.mimeType);

  return {
    id: attachment.attachmentId,
    storage_path: uploadTarget.storage_path,
    file_name: attachment.fileName,
    mime_type: attachment.mimeType,
    file_size_bytes: attachment.fileSizeBytes,
    attachment_kind: attachment.attachmentKind,
    duration_seconds: attachment.durationSeconds,
  };
}

async function postVisit(input: {
  clientId: string | null;
  clientName: string;
  timestamp: string;
  visitType?: string;
  notes?: string | null;
  latitude?: number;
  longitude?: number;
}) {
  return backendApi.post<{ id: string }>("/visits", {
    client_id: input.clientId,
    client_name: input.clientName,
    notes: input.notes,
    visit_type: input.visitType,
    check_in_at: input.timestamp,
    check_in_lat: input.latitude,
    check_in_lng: input.longitude,
  });
}
