import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { isTemporaryConversationId } from "./chatSocket";
import {
  ensureChatSocket,
  getChatSocket,
  subscribeChatErrors,
  subscribeChatMessages,
  trackConversationRoom,
} from "./chatSocketManager";

type SocketChatMessage = {
  id: string;
  conversationId?: string;
  senderType?: string;
  senderName?: string;
  type?: string;
  fileUrl?: string;
  fileName?: string;
  mimeType?: string;
  text?: string;
  createdAt: string;
};

type UseChatSocketOptions = {
  getToken: () => string | null;
  getBrokerOrgId?: () => string | null;
  getLenderOrgId?: () => string | null;
  conversationId?: string | null;
onMessage?: (msg: SocketChatMessage) => void;
  onError?: (message: string) => void;
};

export function useChatSocket({
  getToken,
  getBrokerOrgId,
  getLenderOrgId,
  conversationId,
  onMessage,
  onError,
}: UseChatSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);
  onMessageRef.current = onMessage;
  onErrorRef.current = onError;

  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const socket = ensureChatSocket(token, {
      getBrokerOrgId,
      getLenderOrgId,
    });
    socketRef.current = socket;

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    socket?.on("connect", handleConnect);
    socket?.on("disconnect", handleDisconnect);

    if (socket?.connected) {
      setIsConnected(true);
    }

    const unsubscribeMessage = subscribeChatMessages((msg) => {
      onMessageRef.current?.(msg);
    });
    const unsubscribeError = subscribeChatErrors((message) => {
      onErrorRef.current?.(message);
    });

    return () => {
      unsubscribeMessage();
      unsubscribeError();
      socket?.off("connect", handleConnect);
      socket?.off("disconnect", handleDisconnect);
      socketRef.current = getChatSocket();
    };
  }, [getToken, getBrokerOrgId, getLenderOrgId]);

  useEffect(() => {
    if (!conversationId || isTemporaryConversationId(conversationId)) {
      return;
    }

    trackConversationRoom(conversationId);

    const socket = socketRef.current ?? getChatSocket();
    if (!socket) return;

    const rejoin = () => trackConversationRoom(conversationId);

    socket.io.on("reconnect", rejoin);

    return () => {
      socket.io.off("reconnect", rejoin);
    };
  }, [isConnected, conversationId]);

  return { socketRef, isConnected };
}
