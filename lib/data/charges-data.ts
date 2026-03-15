import { supabase } from "../supabase";
import { generateId } from "../ids";
import { offlineStorage } from "../offline-storage";
import { isOfflineLikeError } from "../sync";
import type { Charge } from "./types";

export async function fetchCharges(userId: string): Promise<Charge[]> {
  const { data, error } = await supabase
    .from("charges")
    .select("*")
    .eq("vendor_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as Charge[];
}

export async function createCharge(input: {
  userId: string;
  vendorName: string;
  clientId: string;
  clientName: string;
  amount: number;
  dueDate: string;
  notes: string;
}) {
  const charge: Charge = {
    id: generateId(),
    vendor_id: input.userId,
    vendor_name: input.vendorName,
    created_by: input.userId,
    client_id: input.clientId || null,
    client_name: input.clientName.trim(),
    amount: input.amount,
    currency: "PYG",
    due_date: input.dueDate || null,
    notes: input.notes.trim() || null,
    status: "pendiente",
  } as Charge;

  const { error } = await supabase.from("charges").insert(charge);

  if (error) {
    if (isOfflineLikeError(error)) {
      await offlineStorage.enqueue({
        type: "charge_create",
        payload: {
          chargeId: charge.id,
          userId: input.userId,
          vendorName: input.vendorName,
          clientId: charge.client_id,
          clientName: charge.client_name,
          amount: charge.amount,
          dueDate: charge.due_date,
          notes: charge.notes,
        },
      });
      return { charge, queued: true as const };
    }
    throw new Error(error.message);
  }

  return { charge, queued: false as const };
}
