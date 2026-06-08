import type { Socket } from "socket.io-client";
import {
  createChatSocket,
  getOrgIdsFromToken,
  isTemporaryConversationId,
  joinConversationRoom,
} from "./chatSocket";

export type SocketChatMessage = {
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

type MessageListener = (msg: SocketChatMessage) => void;
type ErrorListener = (message: string) => void;

type OrgRoomOptions = {
  getBrokerOrgId?: () => string | null;
  getLenderOrgId?: () => string | null;
};

let socket: Socket | null = null;
let activeToken: string | null = null;
let orgRoomOptions: OrgRoomOptions = {};
const messageListeners = new Set<MessageListener>();
const errorListeners = new Set<ErrorListener>();
const conversationIds = new Set<string>();

function resolveOrgIds(token: string) {
  const fromToken = getOrgIdsFromToken(token);
  return {
    brokerOrgId: orgRoomOptions.getBrokerOrgId?.() || fromToken.brokerOrgId,
    lenderOrgId: orgRoomOptions.getLenderOrgId?.() || fromToken.lenderOrgId,
  };
}

function joinOrgRooms(token: string) {
  if (!socket?.connected) return;

  const { brokerOrgId, lenderOrgId } = resolveOrgIds(token);
  if (brokerOrgId) {
    socket.emit("joinBrokerRoom", brokerOrgId);
  }
  if (lenderOrgId) {
    socket.emit("joinLenderRoom", lenderOrgId);
  }
}

function syncConversationRooms() {
  if (!socket?.connected) return;
  conversationIds.forEach((id) => joinConversationRoom(socket, id));
}

function bindSocketHandlers(token: string) {
  if (!socket) return;

  socket.on("connect", () => {
    joinOrgRooms(token);
    syncConversationRooms();
  });

socket.on("newMessage", (msg: SocketChatMessage) => {
    messageListeners.forEach((listener) => listener(msg));
  });

  socket.on("connect_error", (err: Error) => {
    errorListeners.forEach((listener) => listener(err.message));
  });

  socket.on("error", (err: { message?: string } | string) => {
    const message = typeof err === "string" ? err : err?.message;
    if (message) {
      errorListeners.forEach((listener) => listener(message));
    }
  });
}

function teardownSocket() {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
  activeToken = null;
}

function ensureSocket(token: string, options: OrgRoomOptions = {}) {
  orgRoomOptions = options;

  if (socket && activeToken === token) {
    if (socket.connected) {
      joinOrgRooms(token);
      syncConversationRooms();
    }
    return;
  }

  teardownSocket();
  activeToken = token;
  socket = createChatSocket(token);
  bindSocketHandlers(token);

  if (socket.connected) {
    joinOrgRooms(token);
    syncConversationRooms();
  }
}

export function ensureChatSocket(
  token: string,
  options: OrgRoomOptions = {},
): Socket | null {
  ensureSocket(token, options);
  return socket;
}

export function subscribeChatMessages(listener: MessageListener): () => void {
  messageListeners.add(listener);
  return () => messageListeners.delete(listener);
}

export function subscribeChatErrors(listener: ErrorListener): () => void {
  errorListeners.add(listener);
  return () => errorListeners.delete(listener);
}

export function trackConversationRoom(conversationId?: string | null) {
  if (!conversationId || isTemporaryConversationId(conversationId)) {
    return;
  }

  conversationIds.add(conversationId);
  if (socket?.connected) {
    joinConversationRoom(socket, conversationId);
  }
}

export function getChatSocket(): Socket | null {
  return socket;
}

export function disconnectChatSocket() {
  teardownSocket();
  conversationIds.clear();
}
