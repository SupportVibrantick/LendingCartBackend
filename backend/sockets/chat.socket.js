module.exports = function chatSocket(socket, io, prisma) {

  /* =====================================================
     HELPER: GET SENDER NAME
  ===================================================== */
  const getSenderName = async (senderId, senderType) => {
    try {
      if (senderType === "BROKER" || senderType === "LENDER") {
        const user = await prisma.userAccount.findUnique({
          where: { id: senderId },
          select: {
            firstName: true,
            lastName: true,
            organization: {
              select: { name: true },
            },
          },
        });

        return (
          user?.organization?.name ||
          `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
          senderType
        );
      }

      if (senderType === "CLIENT") {
        const user = await prisma.clientPortalUser.findUnique({
          where: { id: senderId },
          select: { legalName: true },
        });

        return user?.legalName || "Client";
      }

      return "Unknown";
    } catch (err) {
      console.error("❌ Sender name fetch error:", err.message);
      return "Unknown";
    }
  };

  /* =====================================================
     1️⃣ JOIN CONVERSATION ROOM (SECURED)
  ===================================================== */
  socket.on("joinConversation", async ({ conversationId }) => {
    try {
      if (!conversationId) return;

      const userId = socket.user.id;

      const participant = await prisma.conversationParticipant.findFirst({
        where: {
          conversationId,
          participantId: userId,
        },
      });

      if (!participant) {
        return socket.emit("error", {
          message: "Access denied to this conversation",
        });
      }

      socket.join(`conversation_${conversationId}`);

      console.log(`💬 [JOIN] ${userId} → ${conversationId}`);
    } catch (err) {
      console.error("❌ Join error:", err.message);
    }
  });

  /* =====================================================
     2️⃣ SEND MESSAGE
  ===================================================== */
  socket.on("sendMessage", async (payload) => {
    try {
      const { conversationId, type, text, fileUrl, fileName } = payload;

      const senderId = socket.user.id;
      const senderType = socket.user.orgType;

      if (!conversationId) {
        return socket.emit("error", { message: "Conversation ID required" });
      }

      if (type === "TEXT" && !text) {
        return socket.emit("error", {
          message: "Text message cannot be empty",
        });
      }

      const participant = await prisma.conversationParticipant.findFirst({
        where: {
          conversationId,
          participantId: senderId,
        },
      });

      if (!participant) {
        return socket.emit("error", {
          message: "You are not part of this conversation",
        });
      }

      const senderName = await getSenderName(senderId, senderType);

      const message = await prisma.message.create({
        data: {
          conversationId,
          senderId,
          senderType,
          senderName,
          type,
          text: type === "TEXT" ? text : null,
          fileUrl: type === "FILE" ? fileUrl : null,
          fileName: type === "FILE" ? fileName : null,
        },
      });

      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: new Date(),
        },
      });

      const response = {
        id: message.id,
        conversationId,
        senderId,
        senderType,
        senderName,
        type,
        text,
        fileUrl,
        fileName,
        createdAt: message.createdAt,
      };

      // send message
      io.to(`conversation_${conversationId}`).emit("newMessage", response);

      // 🔥 trigger unread for others
      socket.to(`conversation_${conversationId}`).emit("newUnread", {
        conversationId,
      });

    } catch (err) {
      console.error("❌ Send message error:", err);
      socket.emit("error", { message: "Failed to send message" });
    }
  });

  /* =====================================================
     3️⃣ TYPING INDICATOR
  ===================================================== */
  socket.on("typing", ({ conversationId }) => {
    socket.to(`conversation_${conversationId}`).emit("typing", {
      userId: socket.user.id,
    });
  });

  socket.on("stopTyping", ({ conversationId }) => {
    socket.to(`conversation_${conversationId}`).emit("stopTyping", {
      userId: socket.user.id,
    });
  });

  /* =====================================================
     4️⃣ MARK AS READ (SEEN)
  ===================================================== */
  socket.on("markAsRead", async ({ conversationId }) => {
    try {
      const userId = socket.user.id;

      await prisma.conversationParticipant.updateMany({
        where: {
          conversationId,
          participantId: userId,
        },
        data: {
          lastReadAt: new Date(),
        },
      });

      socket.to(`conversation_${conversationId}`).emit("messageRead", {
        userId,
        conversationId,
      });

    } catch (err) {
      console.error("❌ Read error:", err);
    }
  });

};