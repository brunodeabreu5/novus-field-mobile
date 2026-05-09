import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import { io, type Socket } from "socket.io-client";
import { getAccessToken } from "../lib/backend-auth";
import { logger } from "../lib/logger";
import { getBackendWsUrl } from "../lib/tenant-config";
import { useAuth } from "../contexts/AuthContext";

interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  created_at: string;
}

interface ChatSocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  lastMessage: ChatMessage | null;
  refetchChat: () => void;
}

const ChatSocketContext = createContext<ChatSocketContextValue>({
  socket: null,
  isConnected: false,
  lastMessage: null,
  refetchChat: () => {},
});

export function useChatSocket() {
  return useContext(ChatSocketContext);
}

interface ChatSocketProviderProps {
  children: React.ReactNode;
}

// Callback to trigger chat refetch globally
let globalRefetchChatCallback: (() => void) | null = null;

export function setGlobalRefetchChat(callback: () => void) {
  globalRefetchChatCallback = callback;
}

export function ChatSocketProvider({ children }: ChatSocketProviderProps) {
  const { user, session, loading } = useAuth();

  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [lastMessage, setLastMessage] = useState<ChatMessage | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const refetchChat = useCallback(() => {
    // Call global callback if set
    if (globalRefetchChatCallback) {
      globalRefetchChatCallback();
    }
  }, []);

  const connect = useCallback(async () => {
    if (!user || !session) {
      logger.debug("ChatSocket", "No user/session, skipping connect");
      return;
    }

    const token = await getAccessToken();
    if (!token) {
      logger.debug("ChatSocket", "No token, skipping connect");
      return;
    }

    // Don't reconnect if already connected
    if (socket?.connected) {
      logger.debug("ChatSocket", "Already connected");
      return;
    }

    try {
      const wsBaseUrl = await getBackendWsUrl();
      const url = `${wsBaseUrl}/chat`;
      logger.debug("ChatSocket", "Connecting");

      const newSocket = io(url, {
        auth: { token },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      newSocket.on("connect", () => {
        logger.debug("ChatSocket", "Connected");
        setIsConnected(true);
      });

      newSocket.on("disconnect", (reason) => {
        logger.debug("ChatSocket", "Disconnected", reason);
        setIsConnected(false);
      });

      newSocket.on("connect_error", (error) => {
        logger.warn("ChatSocket", "Connection error", error.message);
        setIsConnected(false);
      });

      // Listen for messages and trigger refetch
      newSocket.on("chat:message", (payload: unknown) => {
        const message = payload as ChatMessage;
        // Store the last message
        setLastMessage(message);
        // Trigger global refetch
        refetchChat();
      });

      // Also listen for presence updates
      newSocket.on("chat:presence", () => {
        refetchChat();
      });

      // Listen for read receipts
      newSocket.on("chat:read", () => {
        refetchChat();
      });

      setSocket(newSocket);
    } catch {
      // Silently fail - chat will use HTTP polling fallback
    }
  }, [user, session, socket?.connected, refetchChat]);

  const disconnect = useCallback(() => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
      setLastMessage(null);
    }
  }, [socket]);

  // Track connection state to prevent multiple connections
  const isConnectingRef = useRef(false);

  // Connect when user logs in
  useEffect(() => {
    if (!loading && user && session && !isConnectingRef.current) {
      isConnectingRef.current = true;
      connect().finally(() => {
        isConnectingRef.current = false;
      });
    } else if (!user) {
      disconnect();
    }
  }, [user, session, loading, connect, disconnect]);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const wasBackground = appStateRef.current.match(/inactive|background/);
      const isActive = nextAppState === "active";

      appStateRef.current = nextAppState;

      // Reconnect when app comes to foreground
      if (wasBackground && isActive && user && session) {
        connect();
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    return () => {
      subscription.remove();
    };
  }, [user, session, connect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const value = useMemo(
    () => ({ socket, isConnected, lastMessage, refetchChat }),
    [socket, isConnected, lastMessage, refetchChat],
  );

  return (
    <ChatSocketContext.Provider value={value}>
      {children}
    </ChatSocketContext.Provider>
  );
}
