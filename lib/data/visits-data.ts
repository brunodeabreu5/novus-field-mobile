import { endOfDay, startOfDay, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "../supabase";
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

  const { data, error } = await supabase
    .from("visits")
    .select("*")
    .eq("vendor_id", userId)
    .gte("check_in_at", from.toISOString())
    .lte("check_in_at", endOfDay(to).toISOString())
    .order("check_in_at", { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as Visit[];
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

  const { error } = await supabase.from("visits").insert(visit);

  if (error) {
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
    throw new Error(error.message);
  }

  return { visit, queued: false as const };
}
