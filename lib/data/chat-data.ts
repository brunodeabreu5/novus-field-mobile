import * as FileSystem from "expo-file-system/legacy";
import { backendApi } from "../backend-api";
import { generateId } from "../ids";
import { offlineStorage } from "../offline-storage";
import { isOfflineLikeError } from "../sync";
import type {
  ChatAttachment,
  ChatAttachmentKind,
  ChatMessage,
  ChatReaction,
  Contact,
  DraftChatAttachment,
} from "./types";

const ONLINE_THRESHOLD_MS = 10 * 60 * 1000;

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function uploadAttachment(senderId: string, attachment: DraftChatAttachment) {
  const uploadTarget = await backendApi.post<{
    storage_path: string;
    upload_url: string;
  }>("/files/chat-attachments/presign-upload", {
    file_name: attachment.file_name || `attachment-${Date.now()}`,
    mime_type: attachment.mime_type,
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

  return {
    storage_path: uploadTarget.storage_path,
    file_name: attachment.file_name,
    mime_type: attachment.mime_type,
    file_size_bytes: attachment.file_size_bytes,
    attachment_kind: attachment.attachment_kind,
    duration_seconds: attachment.duration_seconds ?? null,
  };
}

function normalizeMessage(message: ChatMessage): ChatMessage {
  return {
    ...message,
    attachments: (message.attachments || []).map((attachment) => ({
      ...attachment,
      attachment_kind: attachment.attachment_kind as ChatAttachmentKind,
      signedUrl: attachment.signedUrl ?? null,
    })),
    reactions: message.reactions || [],
  };
}

export async function fetchContacts(userId: string, _canSeePresence = false): Promise<Contact[]> {
  const contacts = await backendApi.get<Contact[]>("/chat/contacts");
  const now = Date.now();

  return contacts
    .map((contact) => ({
      ...contact,
      isOnline: Boolean(
        contact.isOnline ||
          (contact.lastMessageAt &&
            now - new Date(contact.lastMessageAt).getTime() < ONLINE_THRESHOLD_MS),
      ),
    }))
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
  const messages = await backendApi.get<ChatMessage[]>(
    `/chat/messages?otherUserId=${encodeURIComponent(otherUserId)}`,
  );

  return messages.map(normalizeMessage);
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

  const optimisticMessage: ChatMessage = {
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

  try {
    const uploadedAttachments =
      attachments.length > 0
        ? await Promise.all(
            attachments.map((attachment) =>
              uploadAttachment(input.senderId, attachment),
            ),
          )
        : [];

    const created = await backendApi.post<ChatMessage>("/chat/messages", {
      id: optimisticMessage.id,
      sender_id: optimisticMessage.sender_id,
      receiver_id: optimisticMessage.receiver_id,
      message: optimisticMessage.message,
      created_at: optimisticMessage.created_at,
      attachments: uploadedAttachments,
    });

    return { ...normalizeMessage(created), queued: false as const };
  } catch (error) {
    if (isOfflineLikeError(error)) {
      await offlineStorage.enqueue({
        type: "chat_send",
        payload: {
          messageId: optimisticMessage.id,
          senderId: optimisticMessage.sender_id,
          receiverId: optimisticMessage.receiver_id,
          message: optimisticMessage.message,
          createdAt: optimisticMessage.created_at,
        },
      });

      return { ...optimisticMessage, queued: true as const };
    }

    throw error instanceof Error ? error : new Error("No se pudo enviar la mensagem.");
  }
}

export async function markConversationAsRead(userId: string, otherUserId: string) {
  await backendApi.post("/chat/messages/read", {
    user_id: userId,
    other_user_id: otherUserId,
  });
}

export async function toggleChatReaction(input: {
  messageId: string;
  userId: string;
  emoji: string;
}) {
  return backendApi.post<ChatReaction | null>("/chat/reactions/toggle", {
    id: generateId(),
    message_id: input.messageId,
    user_id: input.userId,
    emoji: input.emoji,
    created_at: new Date().toISOString(),
  });
}

export async function updateChatPresence(userId: string) {
  await backendApi.post("/chat/presence", {
    user_id: userId,
    last_seen_at: new Date().toISOString(),
  });
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
