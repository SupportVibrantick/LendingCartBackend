import { io } from "socket.io-client";
import { broker_admin_token } from "./const";

const URL = process.env.WS_URL ?? "http://localhost:3001"

const socket = io(URL, {
  transports: ["websocket"],
  reconnection: false,
  timeout: 5000,
  extraHeaders: {
    Authorization: `Bearer ${broker_admin_token}`,
  },
});

socket.on("connect", () => {

  socket.emit("health:check", {}, (res: unknown) => {
    console.log(JSON.stringify(res));
    socket.disconnect();
    process.exit(0);
  });
});

socket.on("connect_error", (err) => {
  console.error("auth/connection failed:", err.message);
  socket.disconnect();
  process.exit(1);
});

// setTimeout(() => {
//   console.error("✖ timeout");
//   socket.disconnect();
//   process.exit(1);
// }, 5000);