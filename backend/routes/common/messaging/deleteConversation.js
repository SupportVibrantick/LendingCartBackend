const jwt = require("jsonwebtoken");

/**
 * DELETE Conversation
 * @param {import("fastify").FastifyInstance} fastify
 */
async function deleteConversationRoute(fastify) {
  fastify.delete("/delete/:id", async (req, reply) => {
    const prisma = fastify.prisma;

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

      const conversationId = req.params.id;

      /* ===============================
         CHECK ACCESS
      =============================== */
      const participant = await prisma.conversationParticipant.findFirst({
        where: {
          conversationId,
          OR: [
            decoded.userId ? { userId: decoded.userId } : {},
            decoded.clientId ? { clientUserId: decoded.clientId } : {},
          ],
        },
      });

      if (!participant) {
        return reply.code(403).send({
          success: false,
          message: "You are not part of this conversation",
        });
      }

      /* ===============================
         DELETE ALL RELATED DATA
      =============================== */

      // 1. Delete messages
      await prisma.message.deleteMany({
        where: { conversationId },
      });

      // 2. Delete participants
      await prisma.conversationParticipant.deleteMany({
        where: { conversationId },
      });

      // 3. Delete conversation
      await prisma.conversation.delete({
        where: { id: conversationId },
      });

      /* ===============================
         RESPONSE
      =============================== */
      return reply.send({
        success: true,
        message: "Conversation deleted successfully",
      });

    } catch (error) {
      fastify.log.error({ error: error.message }, "Delete conversation failed");

      return reply.code(500).send({
        success: false,
        message: "Unexpected server error",
      });
    }
  });
}

module.exports = deleteConversationRoute;