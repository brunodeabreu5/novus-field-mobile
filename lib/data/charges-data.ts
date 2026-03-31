import { asItemsArray, backendApi, type CollectionResponse } from "../backend-api";
import { generateId } from "../ids";
import { offlineStorage } from "../offline-storage";
import { isOfflineLikeError } from "../sync";
import type { Charge } from "./types";

export async function fetchCharges(userId: string): Promise<Charge[]> {
  const response = await backendApi.get<CollectionResponse<Charge>>(
    `/charges?vendorId=${encodeURIComponent(userId)}`,
  );
  return asItemsArray(response);
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

  try {
    const created = await backendApi.post<Charge>("/charges", {
      client_id: charge.client_id,
      client_name: charge.client_name,
      amount: charge.amount,
      due_date: charge.due_date,
      notes: charge.notes,
      status: charge.status,
      currency: charge.currency,
    });
    return { charge: created, queued: false as const };
  } catch (error) {
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
    throw error;
  }
}

export async function updateCharge(input: {
  userId: string;
  chargeId: string;
  clientId: string;
  clientName: string;
  amount: number;
  dueDate: string;
  notes: string;
}) {
  return backendApi.patch<Charge>(`/charges/${encodeURIComponent(input.chargeId)}`, {
    client_id: input.clientId || null,
    client_name: input.clientName.trim(),
    amount: input.amount,
    due_date: input.dueDate || null,
    notes: input.notes.trim() || null,
  });
}

export async function updateChargeStatus(input: {
  userId: string;
  chargeId: string;
  status: string;
}) {
  return backendApi.patch<Charge>(`/charges/${encodeURIComponent(input.chargeId)}/status`, {
    status: input.status,
  });
}
