import { endOfDay, startOfDay, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { backendApi } from "../backend-api";
import { generateId } from "../ids";
import { offlineStorage } from "../offline-storage";
import { isOfflineLikeError } from "../sync";
import type { Visit, VisitPeriod } from "./types";

export async function fetchVisits(userId: string, period: VisitPeriod): Promise<Visit[]> {
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
  return backendApi.get<Visit[]>(`/visits?${params.toString()}`);
}

export async function createVisit(input: {
  userId: string;
  vendorName: string;
  clientId: string;
  clientName: string;
  notes: string;
  visitType: string;
}) {
  const visit: Visit = {
    id: generateId(),
    vendor_id: input.userId,
    vendor_name: input.vendorName,
    client_id: input.clientId || null,
    client_name: input.clientName.trim(),
    notes: input.notes.trim() || null,
    visit_type: input.visitType,
    check_in_at: new Date().toISOString(),
  } as Visit;

  try {
    const created = await backendApi.post<Visit>("/visits", {
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
