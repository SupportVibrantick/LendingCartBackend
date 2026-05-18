module.exports = function chatSocket(socket, io, prisma) {

  /* =====================================================
     🔥 HELPER: NORMALIZE USER
  ===================================================== */
  const normalizeUser = (user) => {
    return user?.id || user?.userId || user?.clientId || null;
  };

  console.log("👤 SOCKET CONNECTED USER:", socket.user);

  /* =====================================================
     🔥 HELPER: GET SENDER NAME
  ===================================================== */
  const getSenderName = async (senderId, senderType) => {
    try {
      if (senderType === "BROKER" || senderType === "LENDER") {
        const user = await prisma.userAccount.findUnique({
          where: { id: senderId },
          select: {
            firstName: true,
            lastName: true,
            organization: { select: { name: true } },
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
          select: {
            client: { select: { legalName: true } },
          },
        });

        return user?.client?.legalName || "Client";
      }

      return "Unknown";
    } catch (err) {
      console.error("❌ Sender name error:", err.message);
      return "Unknown";
    }
  };

  /* =====================================================
     1️⃣ JOIN CONVERSATION (FIXED)
  ===================================================== */
  socket.on("joinConversation", async ({ conversationId }) => {
    try {
      
      const userId = normalizeUser(socket.user);
console.log(
  "🔍 JOIN REQUEST:",
  {
    user: socket.user,
    conversationId,
  },
);
      console.log("🔍 JOIN REQUEST:", { userId, conversationId });

      if (!userId) {
        console.log("❌ Invalid user in socket");
        return socket.emit("error", { message: "Invalid user" });
      }

const participant =
  await prisma.conversationParticipant.findFirst({
    where: {
      conversationId,

      OR: [
        {
          participantId: userId,
        },

        socket.user?.email
          ? {
              participantEmail:
                socket.user.email
                  .trim()
                  .toLowerCase(),
            }
          : undefined,
      ].filter(Boolean),
    },
  });

      if (!participant) {
        console.log("❌ NOT PARTICIPANT");
        return socket.emit("error", {
          message: "Access denied to this conversation",
        });
      }

      const room = `conversation_${conversationId}`;

      socket.join(room);
      console.log(
  "✅ JOINED ROOM:",
  room,
);

      console.log(`✅ JOINED ROOM: ${room}`);

      // 🔥 CRITICAL FIX (you were missing this)
      socket.emit("joined", { conversationId });

    } catch (err) {
      console.error("❌ Join error:", err.message);
      socket.emit("error", { message: "Join failed" });
    }
  });

  /* =====================================================
     2️⃣ SEND MESSAGE (FULL FIXED)
  ===================================================== */
  socket.on("sendMessage", async (payload) => {
    try {
      const { conversationId, type, text, fileUrl, fileName } = payload;

      const userId = normalizeUser(socket.user);

      if (!userId) {
        return socket.emit("error", { message: "Invalid user" });
      }

      if (type === "TEXT" && !text) {
        return socket.emit("error", {
          message: "Text message cannot be empty",
        });
      }

const participant =
  await prisma.conversationParticipant.findFirst({
    where: {
      conversationId,

      OR: [
        {
          participantId: userId,
        },

        socket.user?.email
          ? {
              participantEmail:
                socket.user.email
                  .trim()
                  .toLowerCase(),
            }
          : undefined,
      ].filter(Boolean),
    },
  });

      if (!participant) {
        return socket.emit("error", {
          message: "You are not part of this conversation",
        });
      }

      /* ================= DETERMINE SENDER ================= */

      let senderType = "CLIENT";
      let senderUserId = null;
      let senderClientUserId = null;

      if (
        socket.user?.orgType === "BROKER" ||
        socket.user?.orgType === "LENDER"
      ) {
        senderType = socket.user.orgType;
        senderUserId = userId;
      } else {
        senderType = "CLIENT";
        senderClientUserId = userId;
      }

      const senderName = await getSenderName(userId, senderType);

      /* ================= CREATE MESSAGE ================= */

      const message = await prisma.message.create({
        data: {
          conversationId,
          senderType,
          senderUserId,
          senderClientUserId,
          senderName,
          type,
          text: type === "TEXT" ? text : null,
          fileUrl: type === "FILE" ? fileUrl : null,
          fileName: type === "FILE" ? fileName : null,
        },
      });

      await prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      });

      const response = {
        id: message.id,
        conversationId,
        senderType,
        senderUserId,
        senderClientUserId,
        senderName,
        type,
        text,
        fileUrl,
        fileName,
        createdAt: message.createdAt,
      };

      const room = `conversation_${conversationId}`;

      console.log("🚀 EMITTING MESSAGE TO:", room);

      console.log(
  "🚀 EMITTING MESSAGE TO:",
  room,
);

      io.to(room).emit("newMessage", response);

      socket.to(room).emit("newUnread", { conversationId });

    } catch (err) {
      console.error("❌ Send message error:", err.message);
      socket.emit("error", { message: "Failed to send message" });
    }
  });

  /* =====================================================
     3️⃣ MARK AS READ
  ===================================================== */
  socket.on("markAsRead", async ({ conversationId }) => {
    try {
      const userId = normalizeUser(socket.user);

      if (!userId) return;

      await prisma.conversationParticipant.updateMany({
        where: {
          conversationId,
          participantId: userId,
        },
        data: {
          lastReadAt: new Date(),
        },
      });

      const room = `conversation_${conversationId}`;

      socket.to(room).emit("messageRead", {
        userId,
        conversationId,
      });

      console.log("👁️ Marked as read:", conversationId);

    } catch (err) {
      console.error("❌ Read error:", err.message);
    }
  });

};