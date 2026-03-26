import React, { useEffect, useMemo, useRef, useState } from "react";
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
  useUpdateChatPresence,
} from "../hooks/use-mobile-data";
import type { ChatAttachment, ChatMessage, Contact, DraftChatAttachment } from "../lib/mobile-data";
import { getBackendWsUrl } from "../lib/tenant-config";
import type { MainTabParamList } from "../navigation/types";
import { colors } from "../theme/colors";

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

  const {
    data: contacts = [],
    isLoading: contactsLoading,
    refetch: refetchContacts,
  } = useContactsData(user?.id);
  const {
    data: messages = [],
    isLoading: messagesLoading,
    refetch: refetchMessages,
  } = useMessagesData(user?.id, selectedContact?.id);
  const sendChatMessageMutation = useSendChatMessage();
  const markConversationAsReadMutation = useMarkConversationAsRead();
  const toggleReactionMutation = useToggleChatReaction();
  const openChatAttachmentMutation = useOpenChatAttachment();
  const updateChatPresenceMutation = useUpdateChatPresence();

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

    return Array.from(map.values()).sort((left, right) =>
      left.created_at.localeCompare(right.created_at)
    );
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

  useEffect(() => {
    if (!user || !selectedContact) return;

    markConversationAsReadMutation.mutate({
      userId: user.id,
      otherUserId: selectedContact.id,
    });
  }, [markConversationAsReadMutation, selectedContact, user]);

  useEffect(() => {
    if (!user) return;

    updateChatPresenceMutation.mutate({ userId: user.id });
    const interval = setInterval(() => {
      updateChatPresenceMutation.mutate({ userId: user.id });
      refetchContacts();
      if (selectedContact) {
        refetchMessages();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [refetchContacts, refetchMessages, selectedContact, updateChatPresenceMutation, user]);

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
        if (selectedContact && (senderId === selectedContact.id || receiverId === selectedContact.id)) {
          refetchMessages();
        }
        refetchContacts();
      });

      socket.on("chat:read", () => {
        if (selectedContact) {
          refetchMessages();
        }
        refetchContacts();
      });

      socket.on("chat:reaction", () => {
        if (selectedContact) {
          refetchMessages();
        }
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
  }, [refetchContacts, refetchMessages, selectedContact, user]);

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
                     {item.queued ? <Text style={styles.queuedMessageText}>Pendente de sync</Text> : null}
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
    fontSize: 18,
    fontWeight: "600",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    color: colors.foreground,
  },
  searchBox: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.foreground,
    backgroundColor: colors.card,
  },
  contactList: { paddingBottom: 24 },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  contactInfo: { flex: 1 },
  contactNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  contactName: { fontSize: 16, fontWeight: "600", color: colors.foreground },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  statusDotOnline: {
    backgroundColor: "#22c55e",
  },
  statusDotOffline: {
    backgroundColor: "#ef4444",
  },
  contactPreview: { fontSize: 14, color: colors.mutedForeground, marginTop: 2 },
  unreadBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 8,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  empty: { textAlign: "center", color: colors.mutedForeground, padding: 32 },
  chatContainer: { flex: 1, backgroundColor: colors.background },
  backBar: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  backText: { fontSize: 16, color: colors.primary, fontWeight: "600" },
  chatHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  chatHeaderPresence: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chatHeaderPresenceText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.mutedForeground,
  },
  messagesList: { padding: 16, paddingBottom: 24 },
  messageBlock: {
    marginBottom: 10,
  },
  bubble: {
    maxWidth: "84%",
    padding: 12,
    borderRadius: 16,
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
  bubbleText: { fontSize: 15 },
  bubbleTextMe: { color: "#fff" },
  bubbleTextThem: { color: colors.foreground },
  bubbleTime: { fontSize: 11, marginTop: 6 },
  bubbleTimeMe: { color: "rgba(255,255,255,0.8)" },
  bubbleTimeThem: { color: colors.mutedForeground },
  attachmentCard: {
    marginTop: 10,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  attachmentCardQueued: {
    opacity: 0.75,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    borderStyle: "dashed",
  },
  attachmentImage: {
    width: 180,
    height: 120,
  },
  attachmentInfo: {
    padding: 10,
  },
  attachmentTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  attachmentSubtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  queuedAttachmentBadge: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  attachmentAction: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 8,
  },
  queuedMessageText: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "600",
    color: "#fef3c7",
  },
  reactionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
  },
  reactionChip: {
    alignSelf: "flex-start",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  reactionChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  reactionChipText: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: "600",
  },
  quickReactionRow: {
    flexDirection: "row",
    alignSelf: "flex-start",
    gap: 8,
    marginTop: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  quickReactionButton: {
    paddingHorizontal: 2,
  },
  quickReactionText: {
    fontSize: 20,
  },
  emptyMsg: {
    textAlign: "center",
    color: colors.mutedForeground,
    paddingVertical: 32,
  },
  draftAttachmentRow: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 10,
  },
  draftAttachmentCard: {
    width: 210,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 10,
    backgroundColor: colors.card,
  },
  draftImage: {
    width: "100%",
    height: 90,
    borderRadius: 10,
    marginBottom: 8,
  },
  draftAttachmentInfo: {
    gap: 2,
  },
  draftAttachmentTitle: {
    color: colors.foreground,
    fontWeight: "600",
    fontSize: 13,
  },
  draftAttachmentSubtitle: {
    color: colors.mutedForeground,
    fontSize: 12,
  },
  draftQueuedHint: {
    marginTop: 4,
    color: colors.primary,
    fontSize: 11,
    fontWeight: "600",
  },
  removeAttachment: {
    marginTop: 8,
    color: colors.destructive,
    fontSize: 12,
    fontWeight: "600",
  },
  composerActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  toolBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toolBtnText: {
    fontSize: 18,
  },
  toolBtnLabel: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: "600",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
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
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    fontSize: 16,
    color: colors.foreground,
    backgroundColor: colors.card,
  },
  sendBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 22,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: "#fff", fontWeight: "600" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  emojiModal: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
  },
  modalTitle: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
  },
  emojiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  emojiButton: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiText: {
    fontSize: 28,
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
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  imagePreviewCloseText: {
    color: "#fff",
    fontWeight: "600",
  },
});
