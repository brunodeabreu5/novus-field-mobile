import {
  InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  fetchContacts,
  fetchMessagesPage,
  markConversationAsRead,
  openChatAttachment,
  sendChatMessage,
  type ChatMessage,
  type ChatMessagesPage,
  toggleChatReaction,
  updateChatPresence,
} from "../../lib/mobile-data";
import { generateId } from "../../lib/ids";
import { mobileQueryKeys } from "./query-keys";

function appendMessageToInfiniteData(
  current: InfiniteData<ChatMessagesPage> | undefined,
  message: ChatMessage,
) {
  if (!current) {
    return {
      pageParams: [null],
      pages: [{ items: [message], nextCursor: null }],
    };
  }

  if (current.pages.some((page) => page.items.some((item) => item.id === message.id))) {
    return current;
  }

  const pages = [...current.pages];
  const lastPage = pages[pages.length - 1] ?? { items: [], nextCursor: null };
  pages[pages.length - 1] = {
    ...lastPage,
    items: [...lastPage.items, message],
  };

  return {
    ...current,
    pages,
  };
}

function upsertMessageInInfiniteData(
  current: InfiniteData<ChatMessagesPage> | undefined,
  message: ChatMessage,
) {
  if (!current) {
    return {
      pageParams: [null],
      pages: [{ items: [message], nextCursor: null }],
    };
  }

  const exists = current.pages.some((page) => page.items.some((item) => item.id === message.id));
  if (!exists) {
    return appendMessageToInfiniteData(current, message);
  }

  return updateMessageInInfiniteData(current, message.id, () => message);
}

function updateMessageInInfiniteData(
  current: InfiniteData<ChatMessagesPage> | undefined,
  messageId: string,
  updater: (message: ChatMessage) => ChatMessage,
) {
  if (!current) {
    return current;
  }

  return {
    ...current,
    pages: current.pages.map((page) => ({
      ...page,
      items: page.items.map((item) => (item.id === messageId ? updater(item) : item)),
    })),
  };
}

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
  return useInfiniteQuery({
    queryKey:
      userId && otherUserId
        ? mobileQueryKeys.messages(userId, otherUserId)
        : ["messages", "anonymous"],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      fetchMessagesPage({ userId: userId!, otherUserId: otherUserId!, cursor: pageParam }),
    enabled: !!userId && !!otherUserId,
    refetchInterval: 5000,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

export function useSendChatMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: sendChatMessage,
    onMutate: async (variables) => {
      const optimisticMessage: ChatMessage = {
        id: variables.messageId || generateId(),
        sender_id: variables.senderId,
        receiver_id: variables.receiverId,
        message: variables.message.trim(),
        read: false,
        created_at: new Date().toISOString(),
        reply_to_id: null,
        attachments: [],
        reactions: [],
        deliveryStatus: "sending",
        retryPayload: {
          message: variables.message,
          attachments: variables.attachments || [],
        },
      };

      await queryClient.cancelQueries({
        queryKey: mobileQueryKeys.messages(variables.senderId, variables.receiverId),
      });

      queryClient.setQueryData<InfiniteData<ChatMessagesPage>>(
        mobileQueryKeys.messages(variables.senderId, variables.receiverId),
        (current) => upsertMessageInInfiniteData(current, optimisticMessage),
      );

      return { optimisticMessage, variables };
    },
    onSuccess: (message, variables, context) => {
      queryClient.setQueryData<InfiniteData<ChatMessagesPage>>(
        mobileQueryKeys.messages(message.sender_id, message.receiver_id),
        (current) => {
          const withoutOptimistic = context?.optimisticMessage
            ? updateMessageInInfiniteData(current, context.optimisticMessage.id, () => ({
                ...message,
                deliveryStatus: message.queued ? "queued" : "sent",
                retryPayload: context.optimisticMessage.retryPayload,
              }))
            : current;

          if (context?.optimisticMessage && withoutOptimistic !== current) {
            return withoutOptimistic;
          }

          return appendMessageToInfiniteData(current, {
            ...message,
            deliveryStatus: message.queued ? "queued" : "sent",
            retryPayload: context?.optimisticMessage?.retryPayload,
          });
        }
      );
      queryClient.invalidateQueries({
        queryKey: mobileQueryKeys.contacts(message.sender_id),
      });
      queryClient.invalidateQueries({
        queryKey: mobileQueryKeys.contacts(message.receiver_id),
      });
    },
    onError: (error, variables, context) => {
      if (!context?.optimisticMessage) {
        return;
      }

      queryClient.setQueryData<InfiniteData<ChatMessagesPage>>(
        mobileQueryKeys.messages(variables.senderId, variables.receiverId),
        (current) =>
          updateMessageInInfiniteData(current, context.optimisticMessage.id, (message) => ({
            ...message,
            deliveryStatus: "failed",
            retryPayload: context.optimisticMessage.retryPayload,
          })),
      );
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
