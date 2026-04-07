const jwt = require("jsonwebtoken");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function sendMessageRoute(fastify) {
  fastify.post("/send", async (req, reply) => {
    const prisma = fastify.prisma;
    const io = fastify.io; // socket instance

    try {
      /* ===============================
         AUTH
      =============================== */
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return reply.code(401).send({ success: false, message: "Unauthorized" });
      }

      const token = authHeader.split(" ")[1];

      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch {
        return reply.code(401).send({ success: false, message: "Invalid token" });
      }

      /* ===============================
         INPUT
      =============================== */
      const { conversationId, text, type = "TEXT", metadata } = req.body;

      if (!conversationId) {
        return reply.code(400).send({
          success: false,
          message: "conversationId is required",
        });
      }

      if (!text && type === "TEXT") {
        return reply.code(400).send({
          success: false,
          message: "Message text is required",
        });
      }

      /* ===============================
         VALIDATE PARTICIPANT
      =============================== */
      let participantFilter = {};

      if (decoded.role === "CLIENT") {
        participantFilter = {
          conversationId,
          clientUserId: decoded.clientId,
        };
      } else {
        participantFilter = {
          conversationId,
          userId: decoded.userId,
        };
      }

      const participant = await prisma.conversationParticipant.findFirst({
        where: participantFilter,
      });

      if (!participant) {
        return reply.code(403).send({
          success: false,
          message: "Access denied",
        });
      }

      /* ===============================
         CREATE MESSAGE
      =============================== */
      const message = await prisma.message.create({
        data: {
          conversationId,
          senderUserId:
            decoded.role === "CLIENT" ? null : decoded.userId,
          senderClientUserId:
            decoded.role === "CLIENT" ? decoded.clientId : null,
          type,
          text,
          metadata,
        },
      });

      /* ===============================
         UPDATE CONVERSATION
      =============================== */
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: new Date(),
        },
      });

      /* ===============================
         SOCKET EMIT (REALTIME)
      =============================== */
      if (io) {
        io.to(conversationId).emit("new_message", message);
      }

      /* ===============================
         RESPONSE
      =============================== */
      return reply.send({
        success: true,
        data: message,
      });

    } catch (error) {
      fastify.log.error({ error: error.message }, "Send message failed");

      return reply.code(500).send({
        success: false,
        message: "Unexpected server error",
      });
    }
  });
}

module.exports = sendMessageRoute;