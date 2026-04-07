/**
 * Chat Socket (Per Connection)
 * @param {import("socket.io").Socket} socket
 * @param {import("socket.io").Server} io
 * @param {import("@prisma/client").PrismaClient} prisma
 */
module.exports = function chatSocket(socket, io, prisma) {

  /* ===============================
     JOIN CONVERSATION
  =============================== */
  socket.on("join_conversation", ({ conversationId }) => {
    if (!conversationId) {
      console.log("⚠️ [JOIN] Missing conversationId");
      return;
    }

    socket.join(conversationId);

    console.log(`💬 [JOIN CONVERSATION] Socket ${socket.id} joined ${conversationId}`);
  });

  /* ===============================
     LEAVE CONVERSATION
  =============================== */
  socket.on("leave_conversation", ({ conversationId }) => {
    socket.leave(conversationId);

    console.log(`🚪 [LEAVE CONVERSATION] Socket ${socket.id} left ${conversationId}`);
  });

  /* ===============================
     SEND MESSAGE
  =============================== */
  socket.on("send_message", async (data) => {
    try {
      const {
        conversationId,
        text,
        senderUserId,
        senderClientUserId,
        type = "TEXT",
        metadata
      } = data;

      console.log("📨 [SEND MESSAGE REQUEST]", data);

      if (!conversationId) {
        console.log("❌ [ERROR] conversationId missing");
        return;
      }

      /* ===============================
         VALIDATE PARTICIPANT
      =============================== */
      const participant = await prisma.conversationParticipant.findFirst({
        where: {
          conversationId,
          OR: [
            senderUserId ? { userId: senderUserId } : {},
            senderClientUserId ? { clientUserId: senderClientUserId } : {},
          ],
        },
      });

      if (!participant) {
        console.log("❌ [UNAUTHORIZED] User not part of conversation");
        return;
      }

      console.log("✅ [AUTHORIZED] Participant verified");

      /* ===============================
         CREATE MESSAGE
      =============================== */
      const message = await prisma.message.create({
        data: {
          conversationId,
          senderUserId: senderUserId || null,
          senderClientUserId: senderClientUserId || null,
          type,
          text,
          metadata,
        },
      });

      console.log("💾 [DB] Message saved:", message.id);

      /* ===============================
         UPDATE CONVERSATION
      =============================== */
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: new Date(),
        },
      });

      console.log("🔄 [DB] Conversation updated");

      /* ===============================
         EMIT MESSAGE
      =============================== */
      io.to(conversationId).emit("new_message", message);

      console.log(`📡 [EMIT] Message sent to room ${conversationId}`);

    } catch (error) {
      console.error("🔥 [SOCKET ERROR] send_message:", error.message);
    }
  });

  /* ===============================
     TYPING INDICATOR
  =============================== */
  socket.on("typing", ({ conversationId, userId }) => {
    socket.to(conversationId).emit("typing", { userId });

    console.log(`⌨️ [TYPING] ${userId} in ${conversationId}`);
  });

  socket.on("stop_typing", ({ conversationId, userId }) => {
    socket.to(conversationId).emit("stop_typing", { userId });

    console.log(`✋ [STOP TYPING] ${userId} in ${conversationId}`);
  });

};