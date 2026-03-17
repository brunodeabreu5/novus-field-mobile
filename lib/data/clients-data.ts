import { backendApi } from "../backend-api";
import { generateId } from "../ids";
import { offlineStorage } from "../offline-storage";
import { isOfflineLikeError } from "../sync";
import type { Client } from "./types";

export async function fetchClients(): Promise<Client[]> {
  return backendApi.get<Client[]>("/clients?order=name");
}

export async function createClient(input: {
  userId: string;
  name: string;
  document: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  latitude?: number | null;
  longitude?: number | null;
}) {
  const client: Client = {
    id: generateId(),
    created_by: input.userId,
    name: input.name.trim(),
    document: input.document.trim() || null,
    phone: input.phone.trim() || null,
    email: input.email.trim() || null,
    address: input.address.trim() || null,
    notes: input.notes.trim() || null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
  } as Client;

  try {
    const created = await backendApi.post<Client>("/clients", {
      name: client.name,
      document: client.document,
      phone: client.phone,
      email: client.email,
      address: client.address,
      notes: client.notes,
      latitude: client.latitude,
      longitude: client.longitude,
    });
    return { client: created, queued: false as const };
  } catch (error) {
    if (isOfflineLikeError(error)) {
      await offlineStorage.enqueue({
        type: "client_create",
        payload: {
          clientId: client.id,
          userId: input.userId,
          name: client.name,
          document: client.document,
          phone: client.phone,
          email: client.email,
          address: client.address,
          notes: client.notes,
          latitude: client.latitude,
          longitude: client.longitude,
        },
      });
      return { client, queued: true as const };
    }
    throw error;
  }
}
