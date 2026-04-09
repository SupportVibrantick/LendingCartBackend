const { io } = require("socket.io-client");
const readline = require("readline");

/*
Usage:
node socket-test.js <token> <conv1> <conv2> ...
*/

const args = process.argv.slice(2);

if (args.length < 2) {
  console.log("❌ Usage: node socket-test.js <token> <conv1> <conv2> ...");
  process.exit(1);
}

const token = args[0];
const conversationIds = args.slice(1);

/* ===============================
   🔥 CHANGE THIS FOR VPS
=============================== */

// 👉 REPLACE WITH YOUR VPS URL
const SOCKET_URL = "https://api-lendingcart.vibrantick.org";
// example: http://65.2.10.12:3001

/* =============================== */

let activeIndex = 0;
const unreadCounts = {};
const joinedRooms = new Set();

const socket = io(SOCKET_URL, {
  transports: ["websocket"],
  auth: { token },
});

/* ===============================
   READLINE
=============================== */

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

/* ===============================
   CONNECT
=============================== */

socket.on("connect", () => {
  console.log(`🟢 Connected: ${socket.id}`);

  conversationIds.forEach((id, index) => {
    socket.emit("joinConversation", { conversationId: id });
    unreadCounts[id] = 0;
    joinedRooms.add(id);

    console.log(`📡 [${index + 1}] Joined: ${id}`);
  });

  console.log("\n💬 Commands:");
  console.log("👉 <index> <message>");
  console.log("👉 /switch <index>");
  console.log("Example: 1 hello\n");

  console.log(`🟡 Active chat: [1]`);
});

/* ===============================
   SEND MESSAGE (FIXED)
=============================== */

rl.on("line", (input) => {
  input = input.trim();

  // SWITCH CHAT
  if (input.startsWith("/switch")) {
    const index = parseInt(input.split(" ")[1]) - 1;

    if (isNaN(index) || !conversationIds[index]) {
      console.log("❌ Invalid index");
      return;
    }

    activeIndex = index;
    const conversationId = conversationIds[index];

    console.log(`🔄 Switched to chat [${index + 1}]`);

    socket.emit("markAsRead", { conversationId });
    unreadCounts[conversationId] = 0;

    return;
  }

  const parts = input.split(" ");
  const index = parseInt(parts[0]) - 1;
  const text = parts.slice(1).join(" ");

  if (isNaN(index) || !conversationIds[index]) {
    console.log("❌ Invalid index");
    return;
  }

  const conversationId = conversationIds[index];

  /* 🔥 ENSURE JOIN BEFORE SEND */
  if (!joinedRooms.has(conversationId)) {
    socket.emit("joinConversation", { conversationId });
    joinedRooms.add(conversationId);
    console.log("⚠️ Rejoining room...");
  }

  socket.emit("sendMessage", {
    conversationId,
    type: "TEXT",
    text,
  });

  socket.emit("markAsRead", { conversationId });

  console.log(`📤 [YOU → ${conversationId.slice(0, 6)}] ${text}`);
});

/* ===============================
   RECEIVE MESSAGE
=============================== */

socket.on("newMessage", (msg) => {
  console.log("🔥 REALTIME MESSAGE RECEIVED:", msg);

  const isActive =
    conversationIds[activeIndex] === msg.conversationId;

  if (!isActive) {
    unreadCounts[msg.conversationId] =
      (unreadCounts[msg.conversationId] || 0) + 1;
  }

  console.log(
    `📩 [${msg.senderType} - ${msg.senderName}] (${msg.conversationId.slice(
      0,
      6
    )}) ${msg.text}`
  );
});

/* ===============================
   UNREAD
=============================== */

socket.on("newUnread", ({ conversationId }) => {
  unreadCounts[conversationId] =
    (unreadCounts[conversationId] || 0) + 1;

  console.log(
    `🔴 Unread (${conversationId.slice(0, 6)}): ${
      unreadCounts[conversationId]
    }`
  );
});

/* ===============================
   DEBUG EVENTS
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