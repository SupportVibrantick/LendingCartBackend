import { io, type Socket } from "socket.io-client";

export const WS_BASE =
  import.meta.env.VITE_WS_BASE?.replace(/\/$/, "") ||
  "http://localhost:3001";

/**
 * Read the broker JWT from sessionStorage. The ws server's auth middleware
 * expects this in `auth.token` on the handshake.
 */
function readBrokerToken(): string | null {
  try {
    const t = sessionStorage.getItem("broker_token");
    return t && t.length > 0 ? t : null;
  } catch {
    return null;
  }
}

/*
  One socket per browser tab; auto-reconnects with the latest token;
 */

let socket: Socket | null = null;
let creating: Promise<Socket> | null = null;

function buildSocket(): Socket {
  return io(WS_BASE, {
    transports: ["websocket", "polling"],
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
    timeout: 10_000,
    auth: { token: readBrokerToken() },
  });
}

export function getAppSocket(): Socket {
  if (socket) return socket;
  if (!creating) {
    creating = (async () => {
      const s = buildSocket();

      s.on("connect", () => {
        console.log(`[ws] connected: ${s.id}`);
      });
      s.on("disconnect", (reason) => {
        console.log(`[ws] disconnected: ${reason}`);
      });
      s.on("connect_error", (err) => {
        console.warn(`[ws] connect_error: ${err.message}`);
        if (err.message === "Token expired" || err.message === "Invalid token") {
          window.dispatchEvent(new CustomEvent("ws:auth_failed", { detail: err.message }));
        }
      });

      socket = s;
      return s;
    })();
  }
  void creating;
  return socket as unknown as Socket;
}

/**
 * Tear down the current socket and rebuild it with the latest token from
 * sessionStorage. Call this after login/logout/refresh.
 */
export function refreshAppSocketToken(): Socket | null {
  disconnectAppSocket();
  return getAppSocket();
}

export function disconnectAppSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    creating = null;
  }
}
