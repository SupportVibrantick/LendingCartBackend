const { io } = require("socket.io-client");
const readline = require("readline");

/* ===============================
   CLI INPUT
=============================== */

/*
Usage:
node socket-test-1.js <token> <conv1> <conv2> ...
*/

const args = process.argv.slice(2);

if (args.length < 2) {
  console.log(
    "❌ Usage: node socket-test-1.js <token> <conv1> <conv2> ..."
  );
  process.exit(1);
}

const token = args[0];
const conversationIds = args.slice(1);

/* ===============================
   STATE
=============================== */

let activeIndex = 0; // 👈 current active chat
const unreadCounts = {}; // { convId: count }

/* ===============================
   SOCKET INIT
=============================== */

const socket = io("http://localhost:3001", {
  transports: ["websocket"],
  auth: { token },
});

/* ===============================
   READLINE + KEY INPUT
=============================== */

readline.emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

/* ===============================
   CONNECT
=============================== */

socket.on("connect", () => {
  console.log(`🟢 Connected (Broker): ${socket.id}`);

  conversationIds.forEach((id, index) => {
    socket.emit("joinConversation", { conversationId: id });
    unreadCounts[id] = 0;
    console.log(`📡 [${index + 1}] Joined: ${id}`);
  });

  console.log("\n💬 Commands:");
  console.log("👉 <index> <message>");
  console.log("👉 /switch <index>");
  console.log("Example: 1 hello lender\n");

  console.log(`🟡 Active chat: [1]`);
});

/* ===============================
   TYPING DETECTION
=============================== */

let typingTimeout;

process.stdin.on("keypress", () => {
  const conversationId = conversationIds[activeIndex];

  socket.emit("typing", { conversationId });

  clearTimeout(typingTimeout);

  typingTimeout = setTimeout(() => {
    socket.emit("stopTyping", { conversationId });
  }, 1000);
});

/* ===============================
   INPUT HANDLER
=============================== */

rl.on("line", (input) => {
  input = input.trim();

  // 🔁 SWITCH CHAT
  if (input.startsWith("/switch")) {
    const index = parseInt(input.split(" ")[1]) - 1;

    if (isNaN(index) || !conversationIds[index]) {
      console.log("❌ Invalid index");
      return;
    }

    activeIndex = index;
    const conversationId = conversationIds[index];

    console.log(`🔄 Switched to chat [${index + 1}]`);

    // mark read when switching
    socket.emit("markAsRead", { conversationId });
    unreadCounts[conversationId] = 0;

    return;
  }

  // 📤 SEND MESSAGE
  const parts = input.split(" ");
  const index = parseInt(parts[0]) - 1;
  const text = parts.slice(1).join(" ");

  if (isNaN(index) || !conversationIds[index]) {
    console.log("❌ Invalid index");
    return;
  }

  const conversationId = conversationIds[index];

  socket.emit("sendMessage", {
    conversationId,
    type: "TEXT",
    text,
  });

  socket.emit("markAsRead", { conversationId });

  console.log(
    `📤 [YOU → ${conversationId.slice(0, 6)}] ${text}`
  );
});

/* ===============================
   RECEIVE MESSAGE
=============================== */

socket.on("newMessage", (msg) => {
  const isActive =
    conversationIds[activeIndex] === msg.conversationId;

  if (!isActive) {
    unreadCounts[msg.conversationId] =
      (unreadCounts[msg.conversationId] || 0) + 1;
  }

  console.log(
    `📩 [${msg.senderType} - ${msg.senderName}] (${msg.conversationId.slice(0, 6)}) ${msg.text}`
  );

  if (!isActive) {
    console.log(
      `🔴 Unread in (${msg.conversationId.slice(0, 6)}): ${
        unreadCounts[msg.conversationId]
      }`
    );
  }
});

/* ===============================
   UNREAD EVENT
=============================== */

socket.on("newUnread", ({ conversationId }) => {
  unreadCounts[conversationId] =
    (unreadCounts[conversationId] || 0) + 1;

  console.log(
    `🔴 Unread update (${conversationId.slice(0, 6)}): ${
      unreadCounts[conversationId]
    }`
  );
});

/* ===============================
   TYPING EVENTS
=============================== */

socket.on("typing", ({ userId }) => {
  console.log(`✍️ User ${userId} is typing...`);
});

socket.on("stopTyping", ({ userId }) => {
  console.log(`🛑 User ${userId} stopped typing`);
});

/* ===============================
   READ RECEIPT
=============================== */

socket.on("messageRead", ({ userId, conversationId }) => {
  console.log(
    `✔ Seen by ${userId} in ${conversationId.slice(0, 6)}`
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