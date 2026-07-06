const {
  joinConversation,
  sendMessage,
  markAsRead,
  publishConversationJoined,
} = require("../services/chat/chat.service");
const {
  JoinConversationSchema,
  SendMessageSchema,
  MarkAsReadSchema,
  parseSocketPayload,
} = require("../services/chat/chat.schemas");
const {
  checkSocketRateLimit,
  clearSocketRateLimits,
} = require("../services/chat/socketRateLimit");
const { commonLogs } = require("../services/logger/contextLogger");

function ackSuccess(ack, data) {
  if (typeof ack === "function") {
    ack({ success: true, data });
  }
}

function ackError(ack, message, code = "ERROR") {
  if (typeof ack === "function") {
    ack({ success: false, error: { message, code } });
  }
}

function registerChatGateway(socket, io, prisma) {
  const socketContext = {
    ip: socket.handshake?.address,
    headers: { "user-agent": socket.handshake?.headers?.["user-agent"] },
    socket,
  };

  socket.on("joinConversation", async (payload, ack) => {
    const rate = checkSocketRateLimit(socket.id, "joinConversation");
    if (!rate.allowed) {
      ackError(ack, "Too many join requests. Please slow down.", "RATE_LIMITED");
      return;
    }

    const parsed = parseSocketPayload(JoinConversationSchema, payload);
    if (!parsed.success) {
      ackError(ack, parsed.message, "VALIDATION_ERROR");
      return;
    }

    try {
      const result = await joinConversation(
        prisma,
        socket.user,
        parsed.data.conversationId,
      );

      if (!result.success) {
        ackError(ack, result.message, result.code);
        return;
      }

      socket.join(result.data.room);
      publishConversationJoined(socket, parsed.data.conversationId);
      ackSuccess(ack, result.data);
    } catch (error) {
      commonLogs.error("Socket joinConversation failed", {
        error: error.message,
        socketId: socket.id,
      });
      ackError(ack, "Join failed", "INTERNAL_ERROR");
    }
  });

  socket.on("sendMessage", async (payload, ack) => {
    const rate = checkSocketRateLimit(socket.id, "sendMessage");
    if (!rate.allowed) {
      ackError(ack, "Too many messages. Please slow down.", "RATE_LIMITED");
      return;
    }

    const parsed = parseSocketPayload(SendMessageSchema, payload);
    if (!parsed.success) {
      ackError(ack, parsed.message, "VALIDATION_ERROR");
      return;
    }

    try {
      const result = await sendMessage(
        prisma,
        io,
        socket.user,
        parsed.data,
        socketContext,
      );

      if (!result.success) {
        ackError(ack, result.message, result.code);
        return;
      }

      ackSuccess(ack, result.data);
    } catch (error) {
      commonLogs.error("Socket sendMessage failed", {
        error: error.message,
        socketId: socket.id,
      });
      ackError(ack, "Failed to send message", "INTERNAL_ERROR");
    }
  });

  socket.on("markAsRead", async (payload, ack) => {
    const rate = checkSocketRateLimit(socket.id, "markAsRead");
    if (!rate.allowed) {
      ackError(ack, "Too many read updates. Please slow down.", "RATE_LIMITED");
      return;
    }

    const parsed = parseSocketPayload(MarkAsReadSchema, payload);
    if (!parsed.success) {
      ackError(ack, parsed.message, "VALIDATION_ERROR");
      return;
    }

    try {
      const result = await markAsRead(
        prisma,
        io,
        socket.user,
        parsed.data.conversationId,
      );

      if (!result.success) {
        ackError(ack, result.message, result.code);
        return;
      }

      ackSuccess(ack, result.data);
    } catch (error) {
      commonLogs.error("Socket markAsRead failed", {
        error: error.message,
        socketId: socket.id,
      });
      ackError(ack, "Failed to mark as read", "INTERNAL_ERROR");
    }
  });

  socket.on("disconnect", () => {
    clearSocketRateLimits(socket.id);
  });
}

module.exports = registerChatGateway;
