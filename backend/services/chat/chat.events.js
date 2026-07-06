const { emitRealtimeMessage } = require("../messagingAccess");

function publishConversationJoined(socket, conversationId) {
  socket.emit("joined", { conversationId });
}

function publishUnread(io, conversationId, socket) {
  socket.to(`conversation_${conversationId}`).emit("newUnread", {
    conversationId,
  });
}

function publishMessageRead(io, conversationId, userId) {
  io.to(`conversation_${conversationId}`).emit("messageRead", {
    userId,
    conversationId,
  });
}

async function publishMessage(io, prisma, message, conversationId) {
  await emitRealtimeMessage(io, prisma, message, conversationId);
}

module.exports = {
  publishConversationJoined,
  publishUnread,
  publishMessageRead,
  publishMessage,
};
