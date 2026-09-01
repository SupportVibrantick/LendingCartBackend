import { io, type Socket } from "socket.io-client";

export const CHAT_API_BASE =
  import.meta.env.VITE_SOCKET_URL?.replace(/\/$/, "") ||
  import.meta.env.VITE_API_BASE?.replace(/\/$/, "") ||
  "http://localhost:4000";

export function isTemporaryConversationId(id?: string | null) {
  return Boolean(
    id &&
      (id.startsWith("broker-") ||
        id.startsWith("officer-") ||
        id.startsWith("client-")),
  );
}

export function createChatSocket(token: string): Socket {
  return io(CHAT_API_BASE, {
    auth: { token },
    path: "/socket.io",
    transports: ["polling", "websocket"],
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    autoConnect: true,
  });
}

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

/** Resolve org rooms from JWT when session user object omits organizationId. */
export function getOrgIdsFromToken(token: string | null): {
  brokerOrgId: string | null;
  lenderOrgId: string | null;
  clientId: string | null;
} {
  if (!token) return { brokerOrgId: null, lenderOrgId: null, clientId: null };

  const payload = decodeJwtPayload(token);
  if (!payload) return { brokerOrgId: null, lenderOrgId: null, clientId: null };

  const clientId = (payload.clientId as string | undefined) || null;
  if (clientId) {
    return { brokerOrgId: null, lenderOrgId: null, clientId };
  }

  const orgId =
    (payload.organizationId as string | undefined) ||
    (payload.orgId as string | undefined) ||
    null;

  const orgType = payload.orgType as string | undefined;
  const userType = payload.userType as string | undefined;
  const rolesRaw = payload.roles ?? payload.role;
  const roles = Array.isArray(rolesRaw)
    ? rolesRaw
    : rolesRaw
      ? [rolesRaw]
      : [];

  if (orgType === "LENDER" && orgId) {
    return { brokerOrgId: null, lenderOrgId: orgId, clientId: null };
  }

  const brokerRoles = [
    "SUB_BROKER",
    "BROKER_OFFICER",
    "BROKER_ADMIN",
    "BROKER",
    "LOAN_OFFICER",
  ];

  if (
    orgId &&
    (orgType === "BROKER" ||
      userType === "LOAN_OFFICER" ||
      roles.some((role) => brokerRoles.includes(String(role))))
  ) {
    return { brokerOrgId: orgId, lenderOrgId: null, clientId: null };
  }

  if (orgId) {
    return { brokerOrgId: orgId, lenderOrgId: null, clientId: null };
  }

  return { brokerOrgId: null, lenderOrgId: null, clientId: null };
}

export function joinConversationRoom(
  socket: Socket | null | undefined,
  conversationId?: string | null,
) {
  if (!socket || !conversationId || isTemporaryConversationId(conversationId)) {
    return;
  }

  const sync = () => {
    socket.emit("joinConversation", { conversationId });
    socket.emit("markAsRead", { conversationId });
  };

  if (socket.connected) {
    sync();
  } else {
    socket.once("connect", sync);
  }
}

export function bindConversationRoom(
  socket: Socket | null | undefined,
  conversationId?: string | null,
) {
  if (!socket || !conversationId || isTemporaryConversationId(conversationId)) {
    return () => {};
  }

  const sync = () => joinConversationRoom(socket, conversationId);

  if (socket.connected) {
    sync();
  }

  socket.on("connect", sync);
  return () => {
    socket.off("connect", sync);
  };
}
