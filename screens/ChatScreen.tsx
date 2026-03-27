import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Pressable,
  Image,
  ScrollView,
  Alert,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import { io, type Socket } from "socket.io-client";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { format } from "date-fns";
import { useAuth } from "../contexts/AuthContext";
import {
  getAccessToken,
} from "../lib/backend-auth";
import { offlineStorage } from "../lib/offline-storage";
import {
  useContactsData,
  useMarkConversationAsRead,
  useMessagesData,
  useOpenChatAttachment,
  useSendChatMessage,
  useToggleChatReaction,
} from "../hooks/use-mobile-data";
import type { ChatAttachment, ChatMessage, Contact, DraftChatAttachment } from "../lib/mobile-data";
import { getBackendWsUrl } from "../lib/tenant-config";
import { logger } from "../lib/logger";
import type { MainTabParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { spacing, fontSize, radius } from "../theme/spacing";

const s = spacing; const f = fontSize; const r = radius;

const EMOJI_OPTIONS = ["😀", "😂", "😍", "👍", "🔥", "🎉", "🙏", "😎"];
type ExpoAudioModule = typeof import("expo-av").Audio;
type RecordingHandle = import("expo-av").Audio.Recording;
type SoundHandle = import("expo-av").Audio.Sound;

async function loadAudioModule(): Promise<ExpoAudioModule | null> {
  try {
    const module = await import("expo-av");
    return module.Audio;
  } catch {
    return null;
  }
}

function formatDuration(seconds?: number | null) {
  const total = Math.max(0, Math.round(seconds || 0));
  const minutes = Math.floor(total / 60);
  const remaining = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

function buildAttachmentLabel(attachment: DraftChatAttachment | ChatAttachment) {
  if (attachment.attachment_kind === "image") {
    return "Imagem";
  }

  if (attachment.attachment_kind === "audio") {
    return "Audio";
  }

  return "Arquivo";
}

function groupReactions(message: ChatMessage) {
  const grouped = new Map<
    string,
    {
      emoji: string;
      count: number;
      userIds: string[];
    }
  >();

  message.reactions.forEach((reaction) => {
    const current = grouped.get(reaction.emoji) || {
      emoji: reaction.emoji,
      count: 0,
      userIds: [],
    };
    current.count += 1;
    current.userIds.push(reaction.user_id);
    grouped.set(reaction.emoji, current);
  });

  return Array.from(grouped.values());
}

function getMessageStatusLabel(message: ChatMessage) {
  if (message.deliveryStatus === "sending") {
    return "Enviando...";
  }

  if (message.deliveryStatus === "failed") {
    return "Falhou";
  }

  if (message.deliveryStatus === "queued" || message.queued) {
    return "Pendente de sync";
  }

  if (message.deliveryStatus === "sent") {
    return "Enviado";
  }

  return null;
}

export default function ChatScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList, "Chat">>();
  const route = useRoute<RouteProp<MainTabParamList, "Chat">>();
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [draftAttachments, setDraftAttachments] = useState<DraftChatAttachment[]>([]);
  const [emojiModalVisible, setEmojiModalVisible] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [reactionTargetId, setReactionTargetId] = useState<string | null>(null);
  const [recording, setRecording] = useState<RecordingHandle | null>(null);
  const [recordingBusy, setRecordingBusy] = useState(false);
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);
  const [queuedMessages, setQueuedMessages] = useState<ChatMessage[]>([]);
  const listRef = useRef<FlatList>(null);
  const soundRef = useRef<SoundHandle | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const selectedContactRef = useRef<Contact | null>(null);

  const {
    data: contacts = [],
    isLoading: contactsLoading,
    refetch: refetchContacts,
  } = useContactsData(user?.id);
  const {
    data: messagesData,
    isLoading: messagesLoading,
    refetch: refetchMessages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMessagesData(user?.id, selectedContact?.id);
  const sendChatMessageMutation = useSendChatMessage();
  const markConversationAsReadMutation = useMarkConversationAsRead();
  const toggleReactionMutation = useToggleChatReaction();
  const openChatAttachmentMutation = useOpenChatAttachment();

  useEffect(() => {
    selectedContactRef.current = selectedContact;
  }, [selectedContact]);

  const messages = useMemo(
    () => messagesData?.pages.flatMap((page) => page.items) ?? [],
    [messagesData],
  );

  const filteredContacts = useMemo(() => {
    if (!contactSearch.trim()) {
      return contacts;
    }

    const normalized = contactSearch.trim().toLowerCase();
    return contacts.filter((contact) => {
      return (
        contact.full_name.toLowerCase().includes(normalized) ||
        contact.lastMessage?.toLowerCase().includes(normalized)
      );
    });
  }, [contactSearch, contacts]);

  const mergedMessages = useMemo(() => {
    const map = new Map<string, ChatMessage>();

    messages.forEach((message) => {
      map.set(message.id, message);
    });

    queuedMessages.forEach((message) => {
      if (!map.has(message.id)) {
        map.set(message.id, message);
      }
    });

    return Array.from(map.values())
      .sort((left, right) => left.created_at.localeCompare(right.created_at))
      .map((message) => ({
        ...message,
        deliveryStatus: message.deliveryStatus ?? (message.queued ? "queued" : "sent"),
      }));
  }, [messages, queuedMessages]);

  useEffect(() => {
    let cancelled = false;

    const loadQueuedMessages = async () => {
      if (!user || !selectedContact) {
        if (!cancelled) {
          setQueuedMessages([]);
        }
        return;
      }

      const queue = await offlineStorage.getQueue();
      const nextQueued = queue
        .filter(
          (item): item is Extract<(typeof queue)[number], { type: "chat_send" }> =>
            item.type === "chat_send" &&
            item.payload.senderId === user.id &&
            item.payload.receiverId === selectedContact.id
        )
        .map<ChatMessage>((item) => ({
          id: item.payload.messageId,
          sender_id: item.payload.senderId,
          receiver_id: item.payload.receiverId,
          message: item.payload.message,
          read: false,
          created_at: item.payload.createdAt,
          reply_to_id: null,
          attachments: item.payload.attachments.map((attachment) => ({
            id: attachment.attachmentId,
            message_id: item.payload.messageId,
            uploaded_by: item.payload.senderId,
            storage_path: "",
            file_name: attachment.fileName,
            mime_type: attachment.mimeType,
            file_size_bytes: attachment.fileSizeBytes,
            attachment_kind: attachment.attachmentKind as ChatAttachment["attachment_kind"],
            duration_seconds: attachment.durationSeconds,
            created_at: item.payload.createdAt,
            signedUrl: null,
            queued: true,
          })),
          reactions: [],
          queued: true,
          deliveryStatus: "queued",
        }));

      if (!cancelled) {
        setQueuedMessages(nextQueued);
      }
    };

    void loadQueuedMessages();

    return () => {
      cancelled = true;
    };
  }, [messages, selectedContact, user]);

  useEffect(() => {
    if (!selectedContact) {
      return;
    }

    const nextSelectedContact = contacts.find((contact) => contact.id === selectedContact.id);
    if (nextSelectedContact) {
      setSelectedContact(nextSelectedContact);
    }
  }, [contacts, selectedContact]);

  useEffect(() => {
    const contactId = route.params?.contactId;
    if (!contactId || contacts.length === 0) {
      return;
    }

    const initialContact = contacts.find((contact) => contact.id === contactId);
    if (initialContact) {
      setSelectedContact(initialContact);
      navigation.setParams({ contactId: undefined });
    }
  }, [contacts, navigation, route.params?.contactId]);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => undefined);
      }
      if (recording) {
        recording.stopAndUnloadAsync().catch(() => undefined);
      }
    };
  }, [recording]);

  useEffect(() => {
    if (!selectedContact) return;
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: false }));
  }, [messages.length, selectedContact]);

  const handleLoadOlderMessages = useCallback(() => {
    if (!selectedContact || !hasNextPage || isFetchingNextPage) {
      return;
    }

    void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, selectedContact]);

  useEffect(() => {
    if (!user || !selectedContact) return;

    markConversationAsReadMutation.mutate({
      userId: user.id,
      otherUserId: selectedContact.id,
    });
  }, [markConversationAsReadMutation, selectedContact, user]);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const connect = async () => {
      const token = await getAccessToken();
      if (!token || cancelled) return;

      const wsBaseUrl = await getBackendWsUrl();
      const socket = io(`${wsBaseUrl}/chat`, {
        auth: { token },
        transports: ["websocket"],
      });
      socketRef.current = socket;

      socket.on("chat:message", (payload: Record<string, unknown>) => {
        const senderId = typeof payload.sender_id === "string" ? payload.sender_id : null;
        const receiverId = typeof payload.receiver_id === "string" ? payload.receiver_id : null;
        const currentSelectedContact = selectedContactRef.current;
        if (
          currentSelectedContact &&
          (senderId === currentSelectedContact.id || receiverId === currentSelectedContact.id)
        ) {
          refetchMessages();
        }
        refetchContacts();
      });

      socket.on("chat:read", () => {
        if (selectedContactRef.current) {
          refetchMessages();
        }
        refetchContacts();
      });

      socket.on("chat:reaction", () => {
        if (selectedContactRef.current) {
          refetchMessages();
        }
      });

      socket.on("connect_error", (error) => {
        logger.warn("Chat", "Socket connection error", error.message);
      });

      socket.on("chat:presence", () => {
        refetchContacts();
      });
    };

    void connect();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [refetchContacts, refetchMessages, user]);

  const removeDraftAttachment = (uri: string) => {
    setDraftAttachments((current) => current.filter((attachment) => attachment.uri !== uri));
  };

  const insertEmojiIntoMessage = (emoji: string) => {
    setNewMessage((current) => `${current}${emoji}`);
    setEmojiModalVisible(false);
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permiso requerido", "Debe permitir acceso a fotos para anexar imagenes.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: false,
    });

    if (result.canceled || result.assets.length === 0) {
      return;
    }

    const asset = result.assets[0];
    setDraftAttachments((current) => [
      ...current,
      {
        uri: asset.uri,
        file_name: asset.fileName || `imagem-${Date.now()}.jpg`,
        mime_type: asset.mimeType || "image/jpeg",
        file_size_bytes: asset.fileSize || null,
        attachment_kind: "image",
      },
    ]);
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: "*/*",
    });

    if (result.canceled || result.assets.length === 0) {
      return;
    }

    const asset = result.assets[0];
    setDraftAttachments((current) => [
      ...current,
      {
        uri: asset.uri,
        file_name: asset.name,
        mime_type: asset.mimeType || "application/octet-stream",
        file_size_bytes: asset.size || null,
        attachment_kind: asset.mimeType?.startsWith("audio/") ? "audio" : "file",
      },
    ]);
  };

  const toggleRecording = async () => {
    if (recordingBusy) {
      return;
    }

    setRecordingBusy(true);

    try {
      if (recording) {
        const status = await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        setRecording(null);

        if (uri) {
          setDraftAttachments((current) => [
            ...current,
            {
              uri,
              file_name: `audio-${Date.now()}.m4a`,
              mime_type: "audio/mp4",
              file_size_bytes: null,
              attachment_kind: "audio",
              duration_seconds:
                "durationMillis" in status && typeof status.durationMillis === "number"
                  ? status.durationMillis / 1000
                  : null,
            },
          ]);
        }

        return;
      }

      const audioModule = await loadAudioModule();
      if (!audioModule) {
        Alert.alert(
          "Audio",
          "Este build aun no incluye el modulo de audio. Reinstale la app para usar grabacion."
        );
        return;
      }

      const permission = await audioModule.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Permiso requerido",
          "Debe permitir acceso al microfono para grabar audio."
        );
        return;
      }

      await audioModule.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recordingResult = await audioModule.Recording.createAsync(
        audioModule.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recordingResult.recording);
    } catch (error) {
      Alert.alert(
        "Audio",
        error instanceof Error ? error.message : "No se pudo procesar el audio."
      );
    } finally {
      setRecordingBusy(false);
    }
  };

  const toggleAudioPlayback = async (attachment: ChatAttachment) => {
    if (!attachment.signedUrl) {
      return;
    }

    const audioModule = await loadAudioModule();
    if (!audioModule) {
      Alert.alert(
        "Audio",
        "Este build aun no incluye el modulo de audio. Reinstale la app para reproducir audio."
      );
      return;
    }

    if (activeAudioId === attachment.id && soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
      setActiveAudioId(null);
      return;
    }

    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }

    const playback = await audioModule.Sound.createAsync(
      { uri: attachment.signedUrl },
      { shouldPlay: true }
    );

    soundRef.current = playback.sound;
    setActiveAudioId(attachment.id);

    playback.sound.setOnPlaybackStatusUpdate((status) => {
      if ("didJustFinish" in status && status.didJustFinish) {
        playback.sound.unloadAsync().catch(() => undefined);
        soundRef.current = null;
        setActiveAudioId(null);
      }
    });
  };

  const openAttachment = async (attachment: ChatAttachment) => {
    if (attachment.attachment_kind === "image") {
      setImagePreviewUrl(attachment.signedUrl || null);
      return;
    }

    if (attachment.attachment_kind === "audio") {
      await toggleAudioPlayback(attachment);
      return;
    }

    try {
      const localUri = await openChatAttachmentMutation.mutateAsync(attachment);
      const canShare = await Sharing.isAvailableAsync();

      if (canShare) {
        await Sharing.shareAsync(localUri);
        return;
      }

      Alert.alert("Arquivo listo", localUri);
    } catch (error) {
      Alert.alert(
        "Adjunto",
        error instanceof Error ? error.message : "No se pudo abrir el archivo."
      );
    }
  };

  const sendMessage = async () => {
    if (!user || !selectedContact) return;
    if (!newMessage.trim() && draftAttachments.length === 0) return;

    const messageText = newMessage;
    const attachments = draftAttachments;
    setNewMessage("");
    setDraftAttachments([]);

    try {
      await sendChatMessageMutation.mutateAsync({
        senderId: user.id,
        receiverId: selectedContact.id,
        message: messageText,
        attachments,
      });
      refetchContacts();
      refetchMessages();
    } catch (error) {
      setNewMessage(messageText);
      setDraftAttachments(attachments);
      Alert.alert(
        "Chat",
        error instanceof Error ? error.message : "No se pudo enviar la mensagem."
      );
    }
  };

  const retryMessage = async (message: ChatMessage) => {
    if (!user || message.sender_id !== user.id || !message.retryPayload) {
      return;
    }

    try {
      await sendChatMessageMutation.mutateAsync({
        messageId: message.id,
        senderId: message.sender_id,
        receiverId: message.receiver_id,
        message: message.retryPayload.message,
        attachments: message.retryPayload.attachments,
      });
      refetchContacts();
      refetchMessages();
    } catch (error) {
      Alert.alert(
        "Chat",
        error instanceof Error ? error.message : "No se pudo reenviar la mensagem.",
      );
    }
  };

  const handleChangeMessage = (value: string) => {
    setNewMessage(value);
    if (!selectedContact || !socketRef.current) return;
    socketRef.current.emit("chat:typing", {
      toUserId: selectedContact.id,
      isTyping: value.trim().length > 0,
    });
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user) {
      return;
    }

    try {
      await toggleReactionMutation.mutateAsync({
        messageId,
        userId: user.id,
        emoji,
      });
      setReactionTargetId(null);
      refetchMessages();
    } catch (error) {
      Alert.alert(
        "Reaccion",
        error instanceof Error ? error.message : "No se pudo actualizar la reaccion."
      );
    }
  };

  if (contactsLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!selectedContact) {
    return (
      <View style={styles.container}>
        <Text style={styles.listTitle}>Conversaciones</Text>
        <View style={styles.searchBox}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar conversaciones..."
            placeholderTextColor={colors.mutedForeground}
            value={contactSearch}
            onChangeText={setContactSearch}
          />
        </View>
        <FlatList
          data={filteredContacts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.contactRow}
              onPress={() => setSelectedContact(item)}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(item.full_name || "?")[0].toUpperCase()}
                </Text>
              </View>
              <View style={styles.contactInfo}>
                <View style={styles.contactNameRow}>
                  <Text style={styles.contactName}>{item.full_name}</Text>
                  <View
                    style={[
                      styles.statusDot,
                      item.isOnline ? styles.statusDotOnline : styles.statusDotOffline,
                    ]}
                  />
                </View>
                {item.lastMessage ? (
                  <Text style={styles.contactPreview} numberOfLines={1}>
                    {item.lastMessageKind && item.lastMessageKind !== "text"
                      ? `${buildAttachmentLabel({
                          attachment_kind: item.lastMessageKind,
                          uri: "",
                          file_name: "",
                          mime_type: null,
                          file_size_bytes: null,
                        } as DraftChatAttachment)} · ${item.lastMessage}`
                      : item.lastMessage}
                  </Text>
                ) : null}
              </View>
              {item.unread > 0 ? (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{item.unread}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.contactList}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {contactSearch ? "Sin resultados" : "Sin conversaciones"}
            </Text>
          }
        />
      </View>
    );
  }

  return (
    <>
      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={90}
      >
        <TouchableOpacity
          style={styles.backBar}
          onPress={() => setSelectedContact(null)}
        >
          <View style={styles.chatHeaderRow}>
            <Text style={styles.backText}>Volver a {selectedContact.full_name}</Text>
            <View style={styles.chatHeaderPresence}>
              <View
                style={[
                  styles.statusDot,
                  selectedContact.isOnline ? styles.statusDotOnline : styles.statusDotOffline,
                ]}
              />
              <Text style={styles.chatHeaderPresenceText}>
                {selectedContact.isOnline ? "Online" : "Offline"}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {messagesLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={mergedMessages}
            keyExtractor={(item) => item.id}
            onEndReachedThreshold={0.15}
            onEndReached={handleLoadOlderMessages}
            renderItem={({ item }) => {
              const groupedReactions = groupReactions(item);

              return (
                <View style={styles.messageBlock}>
                  <TouchableOpacity
                    onLongPress={() =>
                      setReactionTargetId((current) =>
                        current === item.id ? null : item.id
                      )
                    }
                    activeOpacity={0.9}
                    style={[
                      styles.bubble,
                      item.sender_id === user?.id ? styles.bubbleMe : styles.bubbleThem,
                    ]}
                  >
                    {item.message ? (
                      <Text
                        style={[
                          styles.bubbleText,
                          item.sender_id === user?.id
                            ? styles.bubbleTextMe
                            : styles.bubbleTextThem,
                        ]}
                      >
                        {item.message}
                      </Text>
                    ) : null}

                    {item.attachments.map((attachment: ChatAttachment) => (
                      <Pressable
                        key={attachment.id}
                        onPress={() => openAttachment(attachment)}
                        disabled={attachment.queued}
                        style={[
                          styles.attachmentCard,
                          attachment.queued ? styles.attachmentCardQueued : null,
                        ]}
                      >
                        {attachment.attachment_kind === "image" && attachment.signedUrl ? (
                          <Image
                            source={{ uri: attachment.signedUrl }}
                            style={styles.attachmentImage}
                          />
                        ) : null}

                        <View style={styles.attachmentInfo}>
                          <Text
                            style={[
                              styles.attachmentTitle,
                              item.sender_id === user?.id
                                ? styles.bubbleTextMe
                                : styles.bubbleTextThem,
                            ]}
                            numberOfLines={1}
                          >
                            {attachment.file_name || buildAttachmentLabel(attachment)}
                          </Text>
                          <Text
                            style={[
                              styles.attachmentSubtitle,
                              item.sender_id === user?.id
                                ? styles.bubbleTimeMe
                                : styles.bubbleTimeThem,
                            ]}
                          >
                            {buildAttachmentLabel(attachment)}
                           {attachment.duration_seconds
                               ? ` · ${formatDuration(attachment.duration_seconds)}`
                               : ""}
                           </Text>
                           {attachment.queued ? (
                             <Text style={styles.queuedAttachmentBadge}>Pendente de sync</Text>
                           ) : null}
                           {attachment.attachment_kind === "audio" ? (
                             <Text
                               style={[
                                 styles.attachmentAction,
                                 item.sender_id === user?.id
                                   ? styles.bubbleTextMe
                                   : styles.bubbleTextThem,
                               ]}
                             >
                               {attachment.queued
                                 ? "Sincroniza al volver la conexion"
                                 : activeAudioId === attachment.id
                                 ? "Pausar"
                                 : "Reproducir"}
                             </Text>
                           ) : attachment.attachment_kind === "file" ? (
                            <Text
                              style={[
                                styles.attachmentAction,
                                item.sender_id === user?.id
                                  ? styles.bubbleTextMe
                                  : styles.bubbleTextThem,
                              ]}
                            >
                               {attachment.queued
                                 ? "Sincroniza al volver la conexion"
                                 : "Abrir / compartir"}
                             </Text>
                           ) : null}
                         </View>
                      </Pressable>
                    ))}

                    <View style={styles.messageMetaRow}>
                      <Text
                        style={[
                          styles.bubbleTime,
                          item.sender_id === user?.id
                            ? styles.bubbleTimeMe
                            : styles.bubbleTimeThem,
                        ]}
                      >
                        {format(new Date(item.created_at), "HH:mm")}
                      </Text>
                      {getMessageStatusLabel(item) ? (
                        <Text
                          style={[
                            styles.messageStatusText,
                            item.deliveryStatus === "failed"
                              ? styles.messageStatusFailed
                              : item.deliveryStatus === "sending"
                                ? styles.messageStatusSending
                                : styles.messageStatusQueued,
                          ]}
                        >
                          {getMessageStatusLabel(item)}
                        </Text>
                      ) : null}
                    </View>
                    {item.deliveryStatus === "failed" && item.sender_id === user?.id ? (
                      <TouchableOpacity
                        style={styles.retryMessageButton}
                        onPress={() => retryMessage(item)}
                      >
                        <Text style={styles.retryMessageButtonText}>Reenviar</Text>
                      </TouchableOpacity>
                    ) : null}
                    </TouchableOpacity>

                  {groupedReactions.length > 0 ? (
                    <View style={styles.reactionRow}>
                      {groupedReactions.map((reaction) => (
                        <TouchableOpacity
                          key={`${item.id}-${reaction.emoji}`}
                          style={[
                            styles.reactionChip,
                            reaction.userIds.includes(user?.id || "") &&
                              styles.reactionChipActive,
                          ]}
                          onPress={() => toggleReaction(item.id, reaction.emoji)}
                        >
                          <Text style={styles.reactionChipText}>
                            {reaction.emoji} {reaction.count}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : null}

                  {reactionTargetId === item.id ? (
                    <View style={styles.quickReactionRow}>
                      {EMOJI_OPTIONS.map((emoji) => (
                        <TouchableOpacity
                          key={`${item.id}-${emoji}`}
                          style={styles.quickReactionButton}
                          onPress={() => toggleReaction(item.id, emoji)}
                        >
                          <Text style={styles.quickReactionText}>{emoji}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            }}
            contentContainerStyle={styles.messagesList}
            ListHeaderComponent={
              isFetchingNextPage ? (
                <View style={styles.messagesPaginationLoader}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.messagesPaginationText}>Cargando mensajes anteriores...</Text>
                </View>
              ) : null
            }
            ListEmptyComponent={
              <Text style={styles.emptyMsg}>Escriba un mensaje para comenzar</Text>
            }
          />
        )}

        {draftAttachments.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.draftAttachmentRow}
          >
            {draftAttachments.map((attachment) => (
              <View key={attachment.uri} style={styles.draftAttachmentCard}>
                {attachment.attachment_kind === "image" ? (
                  <Image source={{ uri: attachment.uri }} style={styles.draftImage} />
                ) : null}
                <View style={styles.draftAttachmentInfo}>
                  <Text style={styles.draftAttachmentTitle} numberOfLines={1}>
                    {attachment.file_name}
                  </Text>
                  <Text style={styles.draftAttachmentSubtitle}>
                    {buildAttachmentLabel(attachment)}
                    {attachment.duration_seconds
                      ? ` · ${formatDuration(attachment.duration_seconds)}`
                      : ""}
                  </Text>
                  <Text style={styles.draftQueuedHint}>Se sincroniza si estas offline</Text>
                </View>
                <TouchableOpacity onPress={() => removeDraftAttachment(attachment.uri)}>
                  <Text style={styles.removeAttachment}>Remover</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.composerActionsRow}>
          <TouchableOpacity style={styles.toolBtn} onPress={() => setEmojiModalVisible(true)}>
            <Text style={styles.toolBtnText}>😊</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolBtn} onPress={pickImage}>
            <Text style={styles.toolBtnLabel}>Imagem</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolBtn} onPress={pickDocument}>
            <Text style={styles.toolBtnLabel}>Arquivo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolBtn} onPress={toggleRecording}>
            {recordingBusy ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.toolBtnLabel}>
                {recording ? "Parar audio" : "Gravar audio"}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Mensaje..."
            value={newMessage}
            onChangeText={handleChangeMessage}
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!newMessage.trim() && draftAttachments.length === 0) ||
              sendChatMessageMutation.isPending
                ? styles.sendBtnDisabled
                : null,
            ]}
            onPress={sendMessage}
            disabled={
              (!newMessage.trim() && draftAttachments.length === 0) ||
              sendChatMessageMutation.isPending
            }
          >
            {sendChatMessageMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.sendBtnText}>Enviar</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={emojiModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setEmojiModalVisible(false)}>
          <Pressable style={styles.emojiModal}>
            <Text style={styles.modalTitle}>Emojis</Text>
            <View style={styles.emojiGrid}>
              {EMOJI_OPTIONS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.emojiButton}
                  onPress={() => insertEmojiIntoMessage(emoji)}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!imagePreviewUrl} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.imagePreviewClose} onPress={() => setImagePreviewUrl(null)}>
            <Text style={styles.imagePreviewCloseText}>Fechar</Text>
          </Pressable>
          {imagePreviewUrl ? (
            <Image source={{ uri: imagePreviewUrl }} style={styles.imagePreview} />
          ) : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  listTitle: {
    fontSize: f.lg,
    fontWeight: "600",
    paddingHorizontal: s.md,
    paddingTop: s.md,
    paddingBottom: s.sm,
    color: colors.foreground,
  },
  searchBox: {
    paddingHorizontal: s.md,
    paddingBottom: s.sm,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.lg,
    paddingHorizontal: s.sm,
    paddingVertical: s.sm,
    color: colors.foreground,
    backgroundColor: colors.card,
  },
  contactList: { paddingBottom: s.lg },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: s.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: r.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: s.sm,
  },
  avatarText: { color: colors.primaryForeground, fontSize: f.lg, fontWeight: "600" },
  contactInfo: { flex: 1 },
  contactNameRow: { flexDirection: "row", alignItems: "center", gap: s.sm },
  contactName: { fontSize: f.md, fontWeight: "600", color: colors.foreground },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: r.full,
  },
  statusDotOnline: {
    backgroundColor: colors.success,
  },
  statusDotOffline: {
    backgroundColor: colors.destructive,
  },
  contactPreview: { fontSize: f.base, color: colors.mutedForeground, marginTop: 2 },
  unreadBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: r.md,
    paddingHorizontal: s.xs,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadText: { color: colors.primaryForeground, fontSize: f.sm, fontWeight: "700" },
  empty: { textAlign: "center", color: colors.mutedForeground, padding: s.xl },
  chatContainer: { flex: 1, backgroundColor: colors.background },
  backBar: {
    padding: s.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  backText: { fontSize: f.md, color: colors.primary, fontWeight: "600" },
  chatHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: s.md,
  },
  chatHeaderPresence: {
    flexDirection: "row",
    alignItems: "center",
    gap: s.xs,
  },
  chatHeaderPresenceText: {
    fontSize: f.sm,
    fontWeight: "600",
    color: colors.mutedForeground,
  },
  messagesList: { padding: s.md, paddingBottom: s.lg },
  messageBlock: {
    marginBottom: s.xs,
  },
  bubble: {
    maxWidth: "84%",
    padding: s.sm,
    borderRadius: r.lg,
  },
  bubbleMe: {
    alignSelf: "flex-end",
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    alignSelf: "flex-start",
    backgroundColor: colors.muted,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: f.base },
  bubbleTextMe: { color: colors.primaryForeground },
  bubbleTextThem: { color: colors.foreground },
  bubbleTime: { fontSize: f.xs, marginTop: s.xs },
  bubbleTimeMe: { color: "rgba(255,255,255,0.8)" },
  bubbleTimeThem: { color: colors.mutedForeground },
  messageMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: s.sm,
    marginTop: s.xs,
  },
  messageStatusText: {
    fontSize: f.xs,
    fontWeight: "600",
  },
  messageStatusSending: {
    color: colors.info,
  },
  messageStatusQueued: {
    color: colors.warning,
  },
  messageStatusFailed: {
    color: colors.destructive,
  },
  retryMessageButton: {
    alignSelf: "flex-end",
    marginTop: s.sm,
    paddingHorizontal: s.xs,
    paddingVertical: s.xs,
    borderRadius: r.full,
    borderWidth: 1,
    borderColor: colors.destructive,
  },
  retryMessageButtonText: {
    color: colors.destructive,
    fontSize: f.xs,
    fontWeight: "700",
  },
  attachmentCard: {
    marginTop: s.sm,
    borderRadius: r.md,
    overflow: "hidden",
    backgroundColor: colors.primaryMuted,
  },
  attachmentCardQueued: {
    opacity: 0.75,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
  },
  attachmentImage: {
    width: 180,
    height: 120,
  },
  attachmentInfo: {
    padding: s.xs,
  },
  attachmentTitle: {
    fontSize: f.base,
    fontWeight: "600",
  },
  attachmentSubtitle: {
    fontSize: f.sm,
    marginTop: s.xs,
  },
  queuedAttachmentBadge: {
    alignSelf: "flex-start",
    marginTop: s.xs,
    paddingHorizontal: s.xs,
    paddingVertical: s.xs,
    borderRadius: r.full,
    backgroundColor: colors.primaryMuted,
    color: colors.primaryForeground,
    fontSize: f.xs,
    fontWeight: "600",
  },
  attachmentAction: {
    fontSize: f.sm,
    fontWeight: "600",
    marginTop: s.sm,
  },
  reactionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: s.sm,
    marginTop: s.xs,
  },
  reactionChip: {
    alignSelf: "flex-start",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.full,
    paddingHorizontal: s.xs,
    paddingVertical: s.xs,
  },
  reactionChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  reactionChipText: {
    color: colors.foreground,
    fontSize: f.sm,
    fontWeight: "600",
  },
  quickReactionRow: {
    flexDirection: "row",
    alignSelf: "flex-start",
    gap: s.sm,
    marginTop: s.xs,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.full,
    paddingHorizontal: s.xs,
    paddingVertical: s.xs,
  },
  quickReactionButton: {
    paddingHorizontal: 2,
  },
  quickReactionText: {
    fontSize: f.xl,
  },
  emptyMsg: {
    textAlign: "center",
    color: colors.mutedForeground,
    paddingVertical: s.xl,
  },
  messagesPaginationLoader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: s.sm,
    paddingBottom: s.sm,
  },
  messagesPaginationText: {
    color: colors.mutedForeground,
    fontSize: f.sm,
  },
  draftAttachmentRow: {
    paddingHorizontal: s.sm,
    paddingBottom: s.xs,
    gap: s.sm,
  },
  draftAttachmentCard: {
    width: 210,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.lg,
    padding: s.xs,
    backgroundColor: colors.card,
  },
  draftImage: {
    width: "100%",
    height: 90,
    borderRadius: r.sm,
    marginBottom: s.sm,
  },
  draftAttachmentInfo: {
    gap: 2,
  },
  draftAttachmentTitle: {
    color: colors.foreground,
    fontWeight: "600",
    fontSize: f.sm,
  },
  draftAttachmentSubtitle: {
    color: colors.mutedForeground,
    fontSize: f.sm,
  },
  draftQueuedHint: {
    marginTop: s.xs,
    color: colors.primary,
    fontSize: f.xs,
    fontWeight: "600",
  },
  removeAttachment: {
    marginTop: s.sm,
    color: colors.destructive,
    fontSize: f.sm,
    fontWeight: "600",
  },
  composerActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: s.sm,
    paddingHorizontal: s.sm,
    paddingBottom: s.xs,
  },
  toolBtn: {
    paddingHorizontal: s.sm,
    paddingVertical: s.xs,
    borderRadius: r.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toolBtnText: {
    fontSize: f.lg,
  },
  toolBtnLabel: {
    color: colors.foreground,
    fontSize: f.sm,
    fontWeight: "600",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: s.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.lg,
    paddingHorizontal: s.md,
    paddingVertical: s.xs,
    marginRight: s.sm,
    fontSize: f.md,
    color: colors.foreground,
    backgroundColor: colors.card,
  },
  sendBtn: {
    paddingHorizontal: s.md,
    paddingVertical: s.sm,
    backgroundColor: colors.primary,
    borderRadius: r.lg,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: colors.primaryForeground, fontWeight: "600" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: s.lg,
  },
  emojiModal: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: colors.card,
    borderRadius: r.xl,
    padding: s.md,
  },
  modalTitle: {
    color: colors.foreground,
    fontSize: f.lg,
    fontWeight: "700",
    marginBottom: s.md,
  },
  emojiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: s.md,
  },
  emojiButton: {
    width: 56,
    height: 56,
    borderRadius: r.lg,
    backgroundColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiText: {
    fontSize: f.xl,
  },
  imagePreview: {
    width: "100%",
    height: "72%",
    resizeMode: "contain",
  },
  imagePreviewClose: {
    position: "absolute",
    top: 48,
    right: 24,
    zIndex: 2,
    paddingHorizontal: s.sm,
    paddingVertical: s.xs,
    borderRadius: r.full,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  imagePreviewCloseText: {
    color: colors.primaryForeground,
    fontWeight: "600",
  },
});
