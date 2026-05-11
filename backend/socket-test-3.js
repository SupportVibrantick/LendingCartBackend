const { io } = require("socket.io-client");
const readline = require("readline");

/* ===============================
   CLI INPUT
=============================== */

/*
Usage:
node socket-test-3.js <token> <conversationId>
*/

const token = process.argv[2];
const conversationId = process.argv[3];

if (!token || !conversationId) {
  console.log("❌ Usage: node socket-test-3.js <token> <conversationId>");
  process.exit(1);
}

/* ===============================
   SOCKET INIT (SECURE)
=============================== */

const socket = io("http://localhost:4000", {
  transports: ["websocket"],
  auth: {
    token, // ✅ REQUIRED
  },
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

/* ===============================
   CONNECT
=============================== */

socket.on("connect", () => {
  console.log(`🟢 [Lender] Connected:`, socket.id);

  socket.emit("joinConversation", { conversationId });

  console.log(`💬 Joined conversation: ${conversationId}`);
  console.log("💬 Type message and press Enter:");
});

/* ===============================
   SEND MESSAGE
=============================== */

rl.on("line", (input) => {
  socket.emit("sendMessage", {
    conversationId,
    type: "TEXT",
    text: input,
  });
});

/* ===============================
   RECEIVE MESSAGE
=============================== */

socket.on("newMessage", (msg) => {
  console.log(
    `📩 [${msg.senderType} - ${msg.senderName}] (${msg.conversationId.slice(0, 6)}) ${msg.text}`,
  );
});

/* ===============================
   ERROR
=============================== */

socket.on("error", (err) => {
  console.error("❌ Error:", err);
});

/* ===============================
   DISCONNECT
=============================== */

socket.on("disconnect", (reason) => {
  console.log("🔴 Disconnected:", reason);
});
