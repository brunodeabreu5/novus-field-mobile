import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "../supabase";
import { generateId } from "../ids";
import { offlineStorage } from "../offline-storage";
import { isOfflineLikeError } from "../sync";
import type {
  ChatAttachment,
  ChatAttachmentKind,
  ChatAttachmentRow,
  ChatMessage,
  ChatMessageRow,
  ChatReaction,
  Contact,
  DraftChatAttachment,
} from "./types";

const CHAT_ATTACHMENT_BUCKET = "chat-attachments";
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const ONLINE_THRESHOLD_MS = 10 * 60 * 1000;

async function notifyChatMessage(messageId: string) {
  const { error } = await supabase.functions.invoke("chat-notify", {
    body: { messageId },
  });

  if (error) {
    console.error("Failed to notify chat recipient", error);
  }
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function getAttachmentFallbackLabel(attachment?: ChatAttachmentRow) {
  if (!attachment) {
    return "";
  }

  if (attachment.attachment_kind === "image") {
    return "Imagem";
  }

  if (attachment.attachment_kind === "audio") {
    return "Audio";
  }

  return "Arquivo";
}

async function createSignedUrls(attachments: ChatAttachmentRow[]): Promise<ChatAttachment[]> {
  if (attachments.length === 0) {
    return [];
  }

  const { data, error } = await supabase.storage
    .from(CHAT_ATTACHMENT_BUCKET)
    .createSignedUrls(
      attachments.map((attachment) => attachment.storage_path),
      SIGNED_URL_TTL_SECONDS
    );

  if (error) {
    throw new Error(error.message);
  }

  const urlMap = new Map<string, string | null>();
  (data || []).forEach((entry, index) => {
    urlMap.set(attachments[index].storage_path, entry?.signedUrl ?? null);
  });

  return attachments.map((attachment) => ({
    ...attachment,
    attachment_kind: attachment.attachment_kind as ChatAttachmentKind,
    signedUrl: urlMap.get(attachment.storage_path) ?? null,
  }));
}

async function fetchAttachmentsByMessageIds(messageIds: string[]) {
  if (messageIds.length === 0) {
    return new Map<string, ChatAttachment[]>();
  }

  const { data, error } = await supabase
    .from("chat_attachments")
    .select("*")
    .in("message_id", messageIds)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const signedAttachments = await createSignedUrls((data || []) as ChatAttachmentRow[]);
  const attachmentsByMessage = new Map<string, ChatAttachment[]>();

  signedAttachments.forEach((attachment) => {
    const current = attachmentsByMessage.get(attachment.message_id) || [];
    current.push(attachment);
    attachmentsByMessage.set(attachment.message_id, current);
  });

  return attachmentsByMessage;
}

async function fetchReactionsByMessageIds(messageIds: string[]) {
  if (messageIds.length === 0) {
    return new Map<string, ChatReaction[]>();
  }

  const { data, error } = await supabase
    .from("chat_reactions")
    .select("*")
    .in("message_id", messageIds)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const reactionsByMessage = new Map<string, ChatReaction[]>();

  ((data || []) as ChatReaction[]).forEach((reaction) => {
    const current = reactionsByMessage.get(reaction.message_id) || [];
    current.push(reaction);
    reactionsByMessage.set(reaction.message_id, current);
  });

  return reactionsByMessage;
}

async function hydrateMessages(messages: ChatMessageRow[]): Promise<ChatMessage[]> {
  const messageIds = messages.map((message) => message.id);
  const [attachmentsByMessage, reactionsByMessage] = await Promise.all([
    fetchAttachmentsByMessageIds(messageIds),
    fetchReactionsByMessageIds(messageIds),
  ]);

  return messages.map((message) => ({
    ...message,
    attachments: attachmentsByMessage.get(message.id) || [],
    reactions: reactionsByMessage.get(message.id) || [],
  }));
}

async function uploadAttachment(senderId: string, attachment: DraftChatAttachment) {
  const extension =
    attachment.file_name.split(".").pop()?.toLowerCase() ||
    attachment.mime_type?.split("/").pop() ||
    "bin";
  const path = `${senderId}/${generateId()}-${sanitizeFileName(
    attachment.file_name || `attachment.${extension}`
  )}`;

  const response = await fetch(attachment.uri);
  const blob = await response.blob();

  const { error } = await supabase.storage.from(CHAT_ATTACHMENT_BUCKET).upload(path, blob, {
    contentType: attachment.mime_type || undefined,
    upsert: false,
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    storage_path: path,
    file_name: attachment.file_name,
    mime_type: attachment.mime_type,
    file_size_bytes: attachment.file_size_bytes,
    attachment_kind: attachment.attachment_kind,
    duration_seconds: attachment.duration_seconds ?? null,
  };
}

async function removeUploadedFiles(paths: string[]) {
  if (paths.length === 0) {
    return;
  }

  await supabase.storage.from(CHAT_ATTACHMENT_BUCKET).remove(paths);
}

export async function fetchContacts(userId: string, _canSeePresence = false): Promise<Contact[]> {
  const [{ data: profiles, error: profilesError }, { data: messages, error: messagesError }] =
    await Promise.all([
      supabase.from("profiles").select("id, full_name, role_title").neq("id", userId),
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

  const messageRows = (messages || []) as ChatMessageRow[];
  const attachmentsByMessage = await fetchAttachmentsByMessageIds(
    messageRows.map((message) => message.id)
  );
  const profileIds = ((profiles || []) as Array<{ id: string }>).map((profile) => profile.id);
  const { data: presenceRows, error: presenceError } =
    profileIds.length > 0
      ? await supabase
          .from("chat_presence")
          .select("user_id, last_seen_at")
          .in("user_id", profileIds)
      : { data: [], error: null };

  if (presenceError) {
    console.error("Failed to load chat presence for contacts", presenceError);
  }

  const lastSeenMap = new Map<string, string>();
  ((presenceRows || []) as Array<{ user_id: string; last_seen_at: string }>).forEach((presence) => {
    lastSeenMap.set(presence.user_id, presence.last_seen_at);
  });
  const now = Date.now();

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

  const lastByContact = new Map<
    string,
    { message: string; at: string; kind: "text" | "image" | "audio" | "file" }
  >();
  const unreadByContact = new Map<string, number>();

  messageRows.forEach((message) => {
    const other = message.sender_id === userId ? message.receiver_id : message.sender_id;
    const lastAttachment = attachmentsByMessage.get(message.id)?.[0];

    if (!lastByContact.has(other)) {
      const previewText =
        message.message.trim() || getAttachmentFallbackLabel(lastAttachment) || "Mensagem";
      const previewKind = lastAttachment?.attachment_kind || "text";

      lastByContact.set(other, {
        message: previewText,
        at: message.created_at,
        kind: previewKind,
      });
    }

    if (message.receiver_id === userId && !message.read) {
      unreadByContact.set(other, (unreadByContact.get(other) ?? 0) + 1);
    }
  });

  return Array.from(contactMap.values())
    .map((contact) => {
      const last = lastByContact.get(contact.id);

      return {
        ...contact,
        unread: unreadByContact.get(contact.id) ?? 0,
        lastMessage: last?.message,
        lastMessageAt: last?.at,
        lastMessageKind: last?.kind,
        isOnline: Boolean(
          lastSeenMap.get(contact.id) &&
            now - new Date(lastSeenMap.get(contact.id)!).getTime() < ONLINE_THRESHOLD_MS
        ),
      };
    })
    .sort((left, right) => {
      if (left.unread !== right.unread) {
        return right.unread - left.unread;
      }

      if (left.lastMessageAt && right.lastMessageAt) {
        return right.lastMessageAt.localeCompare(left.lastMessageAt);
      }

      if (left.lastMessageAt) {
        return -1;
      }

      if (right.lastMessageAt) {
        return 1;
      }

      return left.full_name.localeCompare(right.full_name);
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

  return hydrateMessages((data || []) as ChatMessageRow[]);
}

export async function sendChatMessage(input: {
  senderId: string;
  receiverId: string;
  message: string;
  attachments?: DraftChatAttachment[];
}) {
  const trimmedMessage = input.message.trim();
  const attachments = input.attachments || [];

  if (!trimmedMessage && attachments.length === 0) {
    throw new Error("La mensagem precisa de texto o adjunto.");
  }

  if (attachments.length === 0) {
    const message: ChatMessage = {
      id: generateId(),
      sender_id: input.senderId,
      receiver_id: input.receiverId,
      message: trimmedMessage,
      read: false,
      created_at: new Date().toISOString(),
      reply_to_id: null,
      attachments: [],
      reactions: [],
      queued: false,
    };

    const { error } = await supabase.from("chat_messages").insert({
      id: message.id,
      sender_id: message.sender_id,
      receiver_id: message.receiver_id,
      message: message.message,
      read: false,
      created_at: message.created_at,
      reply_to_id: null,
    });

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

    await notifyChatMessage(message.id);

    return { ...message, queued: false as const };
  }

  const uploadedPaths: string[] = [];

  try {
    const uploadedAttachments = await Promise.all(
      attachments.map(async (attachment) => {
        const uploaded = await uploadAttachment(input.senderId, attachment);
        uploadedPaths.push(uploaded.storage_path);
        return uploaded;
      })
    );

    const messageId = generateId();
    const createdAt = new Date().toISOString();
    const { error: messageError } = await supabase.from("chat_messages").insert({
      id: messageId,
      sender_id: input.senderId,
      receiver_id: input.receiverId,
      message: trimmedMessage,
      read: false,
      created_at: createdAt,
      reply_to_id: null,
    });

    if (messageError) {
      throw new Error(messageError.message);
    }

    if (uploadedAttachments.length > 0) {
      const { error: attachmentError } = await supabase.from("chat_attachments").insert(
        uploadedAttachments.map((attachment) => ({
          message_id: messageId,
          uploaded_by: input.senderId,
          ...attachment,
        }))
      );

      if (attachmentError) {
        throw new Error(attachmentError.message);
      }
    }

    await notifyChatMessage(messageId);

    const hydratedAttachments = await createSignedUrls(
      uploadedAttachments.map((attachment) => ({
        id: generateId(),
        message_id: messageId,
        uploaded_by: input.senderId,
        created_at: createdAt,
        ...attachment,
      }))
    );

    return {
      id: messageId,
      sender_id: input.senderId,
      receiver_id: input.receiverId,
      message: trimmedMessage,
      read: false,
      created_at: createdAt,
      reply_to_id: null,
      attachments: hydratedAttachments,
      reactions: [],
      queued: false as const,
    } satisfies ChatMessage;
  } catch (error) {
    await removeUploadedFiles(uploadedPaths);

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("No se pudo enviar el adjunto.");
  }
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

export async function toggleChatReaction(input: {
  messageId: string;
  userId: string;
  emoji: string;
}) {
  const { data: existing, error: existingError } = await supabase
    .from("chat_reactions")
    .select("*")
    .eq("message_id", input.messageId)
    .eq("user_id", input.userId)
    .eq("emoji", input.emoji)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing) {
    const { error } = await supabase.from("chat_reactions").delete().eq("id", existing.id);

    if (error) {
      throw new Error(error.message);
    }

    return null;
  }

  const reaction = {
    id: generateId(),
    message_id: input.messageId,
    user_id: input.userId,
    emoji: input.emoji,
    created_at: new Date().toISOString(),
  } satisfies ChatReaction;

  const { error } = await supabase.from("chat_reactions").insert(reaction);

  if (error) {
    throw new Error(error.message);
  }

  return reaction;
}

export async function openChatAttachment(attachment: ChatAttachment) {
  if (!attachment.signedUrl) {
    throw new Error("Adjunto sin URL disponible.");
  }

  const localUri = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}${
    attachment.id
  }-${sanitizeFileName(attachment.file_name)}`;

  const downloadResult = await FileSystem.downloadAsync(attachment.signedUrl, localUri);
  return downloadResult.uri;
}
