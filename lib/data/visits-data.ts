import { endOfDay, startOfDay, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { asItemsArray, backendApi, type CollectionResponse } from "../backend-api";
import { generateId } from "../ids";
import { offlineStorage } from "../offline-storage";
import { isOfflineLikeError } from "../sync";
import type {
  DraftVisitAttachment,
  VisitAttachment,
  VisitRecord,
  VisitPeriod,
} from "./types";

function toQueuedVisitAttachment(visitId: string, attachment: DraftVisitAttachment) {
  return {
    attachmentId: generateId(),
    visitId,
    localUri: attachment.uri,
    fileName: attachment.file_name,
    mimeType: attachment.mime_type,
    fileSizeBytes: attachment.file_size_bytes,
    attachmentKind: attachment.attachment_kind,
  } as const;
}

export async function fetchVisits(userId: string, period: VisitPeriod): Promise<VisitRecord[]> {
  const from =
    period === "today"
      ? startOfDay(new Date())
      : startOfWeek(new Date(), { locale: es });
  const to = new Date();

  const params = new URLSearchParams({
    vendorId: userId,
    from: from.toISOString(),
    to: endOfDay(to).toISOString(),
    limit: "200",
  });
  const response = await backendApi.get<CollectionResponse<VisitRecord>>(
    `/visits?${params.toString()}`,
  );
  return asItemsArray(response);
}

export async function createVisit(input: {
  userId: string;
  vendorName: string;
  clientId: string | null;
  clientName: string;
  notes: string;
  visitType: string;
}) {
  const visit: VisitRecord = {
    id: generateId(),
    vendor_id: input.userId,
    vendor_name: input.vendorName,
    client_id: input.clientId || null,
    client_name: input.clientName.trim(),
    notes: input.notes.trim() || null,
    visit_type: input.visitType,
    check_in_at: new Date().toISOString(),
    photos_count: 0,
    attachments_count: 0,
    has_attachments: false,
  } as VisitRecord;

  try {
    const created = await backendApi.post<VisitRecord>("/visits", {
      client_id: visit.client_id,
      client_name: visit.client_name,
      notes: visit.notes,
      visit_type: visit.visit_type,
      check_in_at: visit.check_in_at,
    });
    return { visit: created, queued: false as const };
  } catch (error) {
    if (isOfflineLikeError(error)) {
      await offlineStorage.enqueue({
        type: "manual_visit_create",
        payload: {
          visitId: visit.id,
          vendorId: input.userId,
          vendorName: input.vendorName,
          clientId: visit.client_id,
          clientName: visit.client_name,
          notes: visit.notes,
          visitType: visit.visit_type,
          timestamp: visit.check_in_at,
        },
      });
      return { visit, queued: true as const };
    }
    throw error;
  }
}

export async function checkoutVisit(input: {
  userId: string;
  visitId: string;
  timestamp: string;
  latitude?: number | null;
  longitude?: number | null;
}) {
  try {
    const updated = await backendApi.patch<VisitRecord>(
      `/visits/${encodeURIComponent(input.visitId)}/checkout`,
      {
        check_out_at: input.timestamp,
        check_out_lat: input.latitude ?? null,
        check_out_lng: input.longitude ?? null,
      },
    );

    return { visit: updated, queued: false as const };
  } catch (error) {
    if (isOfflineLikeError(error)) {
      await offlineStorage.enqueue({
        type: "check_out",
        payload: {
          visitId: input.visitId,
          zoneId: input.visitId,
          position: {
            lat: input.latitude ?? 0,
            lng: input.longitude ?? 0,
            accuracy: 0,
          },
          timestamp: input.timestamp,
        },
      });

      return {
        visit: {
          id: input.visitId,
          check_out_at: input.timestamp,
          check_out_lat: input.latitude ?? null,
          check_out_lng: input.longitude ?? null,
        } as VisitRecord,
        queued: true as const,
      };
    }

    throw error;
  }
}

export async function fetchVisitAttachments(visitId: string): Promise<VisitAttachment[]> {
  const response = await backendApi.get<{ visit_id: string; attachments: VisitAttachment[] }>(
    `/visits/${encodeURIComponent(visitId)}/attachments`,
  );
  return response.attachments || [];
}

async function uploadVisitAttachment(visitId: string, attachment: DraftVisitAttachment) {
  const uploadTarget = await backendApi.post<{
    storage_path: string;
    upload_url: string;
  }>("/files/visit-attachments/presign-upload", {
    visit_id: visitId,
    file_name: attachment.file_name || `visit-attachment-${Date.now()}`,
    mime_type: attachment.mime_type,
    attachment_kind: attachment.attachment_kind,
  });

  const response = await fetch(attachment.uri);
  const blob = await response.blob();
  const uploadResponse = await fetch(uploadTarget.upload_url, {
    method: "PUT",
    headers: {
      "Content-Type": attachment.mime_type || "application/octet-stream",
    },
    body: blob,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Upload failed: HTTP ${uploadResponse.status}`);
  }

  return backendApi.post<VisitAttachment>(`/visits/${visitId}/attachments`, {
    storage_path: uploadTarget.storage_path,
    file_name: attachment.file_name,
    mime_type: attachment.mime_type,
    file_size_bytes: attachment.file_size_bytes,
    attachment_kind: attachment.attachment_kind,
  });
}

export async function uploadVisitAttachments(
  visitId: string,
  attachments: DraftVisitAttachment[],
) {
  const uploaded: VisitAttachment[] = [];
  const failed: string[] = [];
  let queued = 0;

  for (const attachment of attachments) {
    try {
      uploaded.push(await uploadVisitAttachment(visitId, attachment));
    } catch (error) {
      if (isOfflineLikeError(error)) {
        await offlineStorage.enqueue({
          type: "visit_attachment_upload",
          payload: toQueuedVisitAttachment(visitId, attachment),
        });
        queued += 1;
        continue;
      }

      failed.push(
        error instanceof Error
          ? `${attachment.file_name}: ${error.message}`
          : attachment.file_name,
      );
    }
  }

  return { uploaded, failed, queued };
}

export async function deleteVisitAttachment(visitId: string, attachmentId: string) {
  return backendApi.delete<{ deleted: boolean }>(
    `/visits/${encodeURIComponent(visitId)}/attachments/${encodeURIComponent(attachmentId)}`,
  );
}
