import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { getAppSocket } from "../lib/appSocket";

export type AppSocketStatus = "connecting" | "connected" | "disconnected";

/**
 * Subscribe a component to the app-wide ws socket.
 * Returns the socket and a live connection status.
 */
export function useAppSocket(): { socket: Socket; status: AppSocketStatus } {
  const socket = getAppSocket();
  const [status, setStatus] = useState<AppSocketStatus>(
    socket.connected ? "connected" : "connecting",
  );
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const onConnect = () => mounted.current && setStatus("connected");
    const onDisconnect = () => mounted.current && setStatus("disconnected");
    const onConnectError = () => mounted.current && setStatus("disconnected");

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);

    // Sync state on mount in case socket already connected
    if (socket.connected) setStatus("connected");

    return () => {
      mounted.current = false;
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
    };
  }, [socket]);

  return { socket, status };
}

/**
 * Listen for a single ws event inside a component.
 * Auto-unsubscribes on unmount.
 */
export function useAppSocketEvent<T = unknown>(
  socket: Socket,
  event: string,
  handler: (payload: T) => void,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const wrapped = (payload: T) => handlerRef.current(payload);
    socket.on(event, wrapped);
    return () => {
      socket.off(event, wrapped);
    };
  }, [socket, event]);
}
