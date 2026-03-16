import { supabase } from "../supabase";
import { generateId } from "../ids";
import { offlineStorage } from "../offline-storage";
import { isOfflineLikeError } from "../sync";
import type { Client } from "./types";

export async function fetchClients(): Promise<Client[]> {
  const { data, error } = await supabase.from("clients").select("*").order("name");
  if (error) {
    throw new Error(error.message);
  }
  return (data || []) as Client[];
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

  const { error } = await supabase.from("clients").insert(client);

  if (error) {
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
    throw new Error(error.message);
  }

  return { client, queued: false as const };
}
