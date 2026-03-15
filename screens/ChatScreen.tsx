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
} from "react-native";
import { format } from "date-fns";
import { useAuth } from "../contexts/AuthContext";
import {
  useContactsData,
  useMarkConversationAsRead,
  useMessagesData,
  useSendChatMessage,
} from "../hooks/use-mobile-data";
import type { ChatMessage, Contact } from "../lib/mobile-data";
import { colors } from "../theme/colors";

export default function ChatScreen() {
  const { user } = useAuth();
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const listRef = useRef<FlatList>(null);

  const { data: contacts = [], isLoading: contactsLoading } = useContactsData(user?.id);
  const { data: messages = [], isLoading: messagesLoading } = useMessagesData(
    user?.id,
    selectedContact?.id
  );
  const sendChatMessageMutation = useSendChatMessage();
  const markConversationAsReadMutation = useMarkConversationAsRead();

  const optimisticMessage = useMemo(() => {
    if (
      !user ||
      !selectedContact ||
      !sendChatMessageMutation.isPending ||
      !newMessage.trim()
    ) {
      return null;
    }

    return {
      id: "pending",
      sender_id: user.id,
      receiver_id: selectedContact.id,
      message: newMessage.trim(),
      read: false,
      created_at: new Date().toISOString(),
    } satisfies ChatMessage;
  }, [newMessage, selectedContact, sendChatMessageMutation.isPending, user]);

  const renderedMessages = optimisticMessage
    ? [...messages, optimisticMessage]
    : messages;

  useEffect(() => {
    if (!selectedContact) return;
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: false }));
  }, [renderedMessages.length, selectedContact]);

  useEffect(() => {
    if (!user || !selectedContact) return;

    markConversationAsReadMutation.mutate({
      userId: user.id,
      otherUserId: selectedContact.id,
    });
  }, [markConversationAsReadMutation, selectedContact, user]);

  const sendMessage = async () => {
    if (!user || !selectedContact || !newMessage.trim()) return;

    const messageText = newMessage.trim();
    setNewMessage("");

    await sendChatMessageMutation.mutateAsync({
      senderId: user.id,
      receiverId: selectedContact.id,
      message: messageText,
    });
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
        <FlatList
          data={contacts}
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
                <Text style={styles.contactName}>{item.full_name}</Text>
                {item.lastMessage ? (
                  <Text style={styles.contactPreview} numberOfLines={1}>
                    {item.lastMessage}
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
          ListEmptyComponent={<Text style={styles.empty}>Sin conversaciones</Text>}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.chatContainer}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      <TouchableOpacity
        style={styles.backBar}
        onPress={() => setSelectedContact(null)}
      >
        <Text style={styles.backText}>Volver a {selectedContact.full_name}</Text>
      </TouchableOpacity>

      {messagesLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={renderedMessages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View
              style={[
                styles.bubble,
                item.sender_id === user?.id ? styles.bubbleMe : styles.bubbleThem,
              ]}
            >
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
            </View>
          )}
          contentContainerStyle={styles.messagesList}
          ListEmptyComponent={
            <Text style={styles.emptyMsg}>Escriba un mensaje para comenzar</Text>
          }
        />
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Mensaje..."
          value={newMessage}
          onChangeText={setNewMessage}
          placeholderTextColor={colors.mutedForeground}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            (!newMessage.trim() || sendChatMessageMutation.isPending) &&
              styles.sendBtnDisabled,
          ]}
          onPress={sendMessage}
          disabled={!newMessage.trim() || sendChatMessageMutation.isPending}
        >
          {sendChatMessageMutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.sendBtnText}>Enviar</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  listTitle: {
    fontSize: 18,
    fontWeight: "600",
    padding: 16,
    color: colors.foreground,
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
  contactName: { fontSize: 16, fontWeight: "600", color: colors.foreground },
  contactPreview: { fontSize: 14, color: colors.mutedForeground },
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
  chatContainer: { flex: 1 },
  backBar: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  backText: { fontSize: 16, color: colors.primary, fontWeight: "600" },
  messagesList: { padding: 16, paddingBottom: 24 },
  bubble: {
    maxWidth: "80%",
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
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
  bubbleTime: { fontSize: 11, marginTop: 4 },
  bubbleTimeMe: { color: "rgba(255,255,255,0.8)" },
  bubbleTimeThem: { color: colors.mutedForeground },
  emptyMsg: {
    textAlign: "center",
    color: colors.mutedForeground,
    paddingVertical: 32,
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
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    fontSize: 16,
    color: colors.foreground,
  },
  sendBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 22,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: "#fff", fontWeight: "600" },
});
