const { io } = require("socket.io-client");
const readline = require("readline");

const socket = io("http://localhost:3001", {
  transports: ["websocket"],
});

const conversationId = "ca4e9546-d62e-4887-8327-5bc95f02999e";
const senderId = "ee24fb00-8f0c-4cfe-abf8-e6887135e239"; // replace

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

socket.on("connect", () => {
  console.log("🟢 [Client] Connected:", socket.id);

  socket.emit("joinConversation", { conversationId });

  console.log("💬 Type message and press Enter:");
});

rl.on("line", (input) => {
  socket.emit("sendMessage", {
    conversationId,
    senderId,
    senderType: "CLIENT",
    type: "TEXT",
    text: input,
  });
});

socket.on("newMessage", (msg) => {
  console.log(`📩 [${msg.senderType}] ${msg.text}`);
});