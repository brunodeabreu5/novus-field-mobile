import { supabase } from "../supabase";
import { generateId } from "../ids";
import { offlineStorage } from "../offline-storage";
import { isOfflineLikeError } from "../sync";
import type { ChatMessage, Contact } from "./types";

export async function fetchContacts(userId: string): Promise<Contact[]> {
  const [{ data: profiles, error: profilesError }, { data: messages, error: messagesError }] =
    await Promise.all([
      supabase.from("profiles").select("id, full_name, role_title"),
      supabase
        .from("chat_messages")
        .select("*")
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order("created_at", { ascending: false }),
    ]);

  if (profilesError) {
    throw new Error(profilesError.message);
  }

  if (messagesError) {
    throw new Error(messagesError.message);
  }

  const contactIds = new Set<string>();
  (messages || []).forEach((message) => {
    const other = message.sender_id === userId ? message.receiver_id : message.sender_id;
    contactIds.add(other);
  });

  const contactMap = new Map(
    (profiles || []).map((profile) => [
      profile.id,
      {
        id: profile.id,
        full_name: profile.full_name || "Usuario",
        role_title: profile.role_title,
        unread: 0,
      } as Contact,
    ])
  );

  contactIds.forEach((id) => {
    if (!contactMap.has(id)) {
      contactMap.set(id, {
        id,
        full_name: "Usuario",
        role_title: null,
        unread: 0,
      });
    }
  });

  const lastByContact = new Map<string, { msg: string; at: string }>();
  const unreadByContact = new Map<string, number>();
  (messages || []).forEach((message) => {
    const other = message.sender_id === userId ? message.receiver_id : message.sender_id;
    if (!lastByContact.has(other)) {
      lastByContact.set(other, { msg: message.message, at: message.created_at });
    }

    if (message.receiver_id === userId && !message.read) {
      unreadByContact.set(other, (unreadByContact.get(other) ?? 0) + 1);
    }
  });

  return Array.from(contactMap.values()).map((contact) => {
    const last = lastByContact.get(contact.id);
    return {
      ...contact,
      unread: unreadByContact.get(contact.id) ?? 0,
      lastMessage: last?.msg,
      lastMessageAt: last?.at,
    };
  });
}

export async function fetchMessages(userId: string, otherUserId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .or(
      `and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`
    )
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as ChatMessage[];
}

export async function sendChatMessage(input: {
  senderId: string;
  receiverId: string;
  message: string;
}) {
  const message: ChatMessage = {
    id: generateId(),
    sender_id: input.senderId,
    receiver_id: input.receiverId,
    message: input.message.trim(),
    read: false,
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("chat_messages").insert(message);
  if (error) {
    if (isOfflineLikeError(error)) {
      await offlineStorage.enqueue({
        type: "chat_send",
        payload: {
          messageId: message.id,
          senderId: message.sender_id,
          receiverId: message.receiver_id,
          message: message.message,
          createdAt: message.created_at,
        },
      });
      return { ...message, queued: true as const };
    }
    throw new Error(error.message);
  }

  return { ...message, queued: false as const };
}

export async function markConversationAsRead(userId: string, otherUserId: string) {
  const { error } = await supabase
    .from("chat_messages")
    .update({ read: true })
    .eq("sender_id", otherUserId)
    .eq("receiver_id", userId)
    .eq("read", false);

  if (error) {
    throw new Error(error.message);
  }
}
