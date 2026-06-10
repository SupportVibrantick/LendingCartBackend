import { io, type Socket } from "socket.io-client";
import { ADMIN_API_BASE } from "./adminApi";

type EventListener = (payload: unknown) => void;

let socket: Socket | null = null;
let activeToken: string | null = null;
const eventListeners = new Map<string, Set<EventListener>>();
const boundSocketEvents = new Set<string>();

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split(".")[1];
    if (!base64) return null;
    const json = atob(base64.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getPlatformOrgIdFromToken(token: string | null): string | null {
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  return (
    (payload.orgId as string | undefined) ||
    (payload.organizationId as string | undefined) ||
    null
  );
}

export function getPlatformOrgIdFromSession(): string | null {
  try {
    const user = JSON.parse(sessionStorage.getItem("admin_user") || "{}");
    if (user.orgId) return user.orgId;
    if (user.organizationId) return user.organizationId;
  } catch {
    /* ignore */
  }
  return getPlatformOrgIdFromToken(sessionStorage.getItem("admin_token"));
}

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

function joinPlatformRoom() {
  if (!socket?.connected) return;

  const platformOrgId = getPlatformOrgIdFromSession();
  if (platformOrgId) {
    socket.emit("joinPlatformRoom", platformOrgId);
  }
}

function teardownSocket() {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
  activeToken = null;
  boundSocketEvents.clear();
}

function bindSocketHandlers() {
  if (!socket) return;

  socket.on("connect", () => {
    joinPlatformRoom();
  });

  bindCustomSocketEvents();
}

function ensureSocket(token: string) {
  if (socket && activeToken === token) {
    if (socket.connected) joinPlatformRoom();
    return;
  }

  teardownSocket();
  activeToken = token;

  socket = io(ADMIN_API_BASE, {
    auth: { token },
    transports: ["websocket", "polling"],
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
  });

  bindSocketHandlers();

  if (socket.connected) {
    joinPlatformRoom();
  }
}

export function ensureAdminSocket(token: string): Socket | null {
  ensureSocket(token);
  return socket;
}

export function subscribeAdminSocketEvent(
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

export function disconnectAdminSocket() {
  teardownSocket();
}
