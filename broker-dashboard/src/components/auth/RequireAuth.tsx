import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import {
  clearBrokerSession,
  isBrokerTokenExpired,
} from "../../lib/brokerSession";
// import { refreshAppSocketToken, disconnectAppSocket } from "../../lib/appSocket";

type Props = {
  children: React.ReactElement;
};

/**
 * Protects routes by checking sessionStorage for a valid, non-expired broker token.
 * Also keeps the app-wide ws socket in sync with the current token.
 */
export default function RequireAuth({ children }: Props) {
  const location = useLocation();
  const token =
    typeof window !== "undefined"
      ? sessionStorage.getItem("broker_token")
      : null;

  // new websocket
  // useEffect(() => {
  //   if (token) {
  // Rebuild the ws socket with the current token so the server's auth
  // middleware accepts the handshake.
  //     refreshAppSocketToken();
  //   } else {
  //     disconnectAppSocket();
  //   }
  // }, [token]);

  if (!token || isBrokerTokenExpired(token)) {
    if (token) {
      clearBrokerSession();
    }
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  return children;
}
