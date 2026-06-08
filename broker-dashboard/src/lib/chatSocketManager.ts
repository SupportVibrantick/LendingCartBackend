import type { Socket } from "socket.io-client";
import {
  createChatSocket,
  getOrgIdsFromToken,
  isTemporaryConversationId,
  joinConversationRoom,
} from "./chatSocket";

type MessageListener = (msg: Record<string, unknown>) => void;
type ErrorListener = (message: string) => void;
type EventListener = (payload: unknown) => void;

type OrgRoomOptions = {
  getBrokerOrgId?: () => string | null;
  getLenderOrgId?: () => string | null;
};

let socket: Socket | null = null;
let activeToken: string | null = null;
let orgRoomOptions: OrgRoomOptions = {};
const messageListeners = new Set<MessageListener>();
const errorListeners = new Set<ErrorListener>();
const eventListeners = new Map<string, Set<EventListener>>();
const boundSocketEvents = new Set<string>();
const conversationIds = new Set<string>();

function notifyEventListeners(event: string, payload: unknown) {
  eventListeners.get(event)?.forEach((listener) => listener(payload));
}

function bindCustomSocketEvents() {
  if (!socket) return;

  for (const event of eventListeners.keys()) {
    if (boundSocketEvents.has(event)) continue;
    socket.on(event, (payload: unknown) => notifyEventListeners(event, payload));
    boundSocketEvents.add(event);
  }
}

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

  socket.on("newMessage", (msg: Record<string, unknown>) => {
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

  bindCustomSocketEvents();
}

function teardownSocket() {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
  activeToken = null;
  boundSocketEvents.clear();
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

/** Keep one socket alive for the session; survives chat tab unmounts. */
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

export function subscribeSocketEvent(
  event: string,
  listener: EventListener,
): () => void {
  if (!eventListeners.has(event)) {
    eventListeners.set(event, new Set());
  }

  eventListeners.get(event)!.add(listener);
  bindCustomSocketEvents();

  return () => {
    eventListeners.get(event)?.delete(listener);
  };
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
