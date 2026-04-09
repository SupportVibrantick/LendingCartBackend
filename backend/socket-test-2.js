const { io } = require("socket.io-client");
const readline = require("readline");

/*
Usage:
node client-test.js <TOKEN> <CONVERSATION_ID>
*/

const args = process.argv.slice(2);

if (args.length < 2) {
  console.log("❌ Usage: node client-test.js <token> <conversationId>");
  process.exit(1);
}

const token = args[0];
const conversationId = args[1];

/* ===============================
   🔥 VPS / LOCAL URL
=============================== */

// change to VPS when needed
const SOCKET_URL = "https://api-lendingcart.vibrantick.org";

/* =============================== */

let joined = false;

const socket = io(SOCKET_URL, {
  transports: ["websocket"],
  auth: { token }, // ✅ REQUIRED
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

/* ===============================
   CONNECT
=============================== */

socket.on("connect", () => {
  console.log("🟢 [Client] Connected:", socket.id);

  console.log("🔗 Joining conversation...");

  socket.emit("joinConversation", { conversationId });
});

/* ===============================
   JOIN CONFIRM (IMPORTANT)
=============================== */

socket.on("joined", ({ conversationId }) => {
  console.log("✅ Joined:", conversationId);
  joined = true;

  console.log("\n💬 Type message and press Enter:\n");
});

/* ===============================
   SEND MESSAGE
=============================== */

rl.on("line", (input) => {
  if (!joined) {
    console.log("⏳ Not joined yet, wait...");
    return;
  }

  socket.emit("sendMessage", {
    conversationId,
    type: "TEXT",
    text: input,
  });

  console.log("📤 You:", input);
});

/* ===============================
   RECEIVE MESSAGE
=============================== */

socket.on("newMessage", (msg) => {
  console.log("🔥 REALTIME RECEIVED:", msg);

  console.log(`📩 [${msg.senderType}] ${msg.text}`);
});

/* ===============================
   DEBUG
=============================== */

socket.on("connect_error", (err) => {
  console.error("❌ Connection error:", err.message);
});

socket.on("error", (err) => {
  console.error("❌ Socket error:", err);
});

socket.on("disconnect", (reason) => {
  console.log("🔴 Disconnected:", reason);
});