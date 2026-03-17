import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchContacts,
  fetchMessages,
  markConversationAsRead,
  openChatAttachment,
  sendChatMessage,
  type ChatMessage,
  toggleChatReaction,
  updateChatPresence,
} from "../../lib/mobile-data";
import { mobileQueryKeys } from "./query-keys";

export function useContactsData(userId?: string, canSeePresence = false) {
  return useQuery({
    queryKey: userId
      ? [...mobileQueryKeys.contacts(userId), canSeePresence]
      : ["contacts", "anonymous", canSeePresence],
    queryFn: () => fetchContacts(userId!, canSeePresence),
    enabled: !!userId,
    refetchInterval: 30000,
  });
}

export function useMessagesData(userId?: string, otherUserId?: string) {
  return useQuery({
    queryKey:
      userId && otherUserId
        ? mobileQueryKeys.messages(userId, otherUserId)
        : ["messages", "anonymous"],
    queryFn: () => fetchMessages(userId!, otherUserId!),
    enabled: !!userId && !!otherUserId,
    refetchInterval: 5000,
  });
}

export function useSendChatMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: sendChatMessage,
    onSuccess: (message) => {
      queryClient.setQueryData<ChatMessage[]>(
        mobileQueryKeys.messages(message.sender_id, message.receiver_id),
        (current = []) => {
          if (current.some((item) => item.id === message.id)) {
            return current;
          }
          return [...current, message];
        }
      );
      queryClient.invalidateQueries({
        queryKey: mobileQueryKeys.contacts(message.sender_id),
      });
      queryClient.invalidateQueries({
        queryKey: mobileQueryKeys.contacts(message.receiver_id),
      });
    },
  });
}

export function useMarkConversationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      otherUserId,
    }: {
      userId: string;
      otherUserId: string;
    }) => markConversationAsRead(userId, otherUserId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: mobileQueryKeys.contacts(variables.userId),
      });
      queryClient.invalidateQueries({
        queryKey: mobileQueryKeys.messages(variables.userId, variables.otherUserId),
      });
    },
  });
}

export function useToggleChatReaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: toggleChatReaction,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["messages"],
      });
      queryClient.invalidateQueries({
        queryKey: ["contacts"],
      });
    },
  });
}

export function useOpenChatAttachment() {
  return useMutation({
    mutationFn: openChatAttachment,
  });
}

export function useUpdateChatPresence() {
  return useMutation({
    mutationFn: ({ userId }: { userId: string }) => updateChatPresence(userId),
  });
}
