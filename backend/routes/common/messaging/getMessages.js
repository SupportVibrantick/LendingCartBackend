const jwt = require("jsonwebtoken");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function getMessagesRoute(fastify) {
  fastify.get("/messages", async (req, reply) => {
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

      /* ===============================
         INPUT
      =============================== */
      const { conversationId, cursor, limit = 20 } = req.query;

      if (!conversationId) {
        return reply.code(400).send({
          success: false,
          message: "conversationId is required",
        });
      }

      /* ===============================
         VALIDATE ACCESS
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
         FETCH MESSAGES (PAGINATION)
      =============================== */
      const messages = await prisma.message.findMany({
        where: {
          conversationId,
        },
        take: Number(limit),
        skip: cursor ? 1 : 0,
        cursor: cursor
          ? {
              id: cursor,
            }
          : undefined,
        orderBy: {
          createdAt: "desc",
        },
      });

      /* ===============================
         RESPONSE
      =============================== */
      return reply.send({
        success: true,
        data: messages,
        nextCursor: messages.length
          ? messages[messages.length - 1].id
          : null,
      });

    } catch (error) {
      fastify.log.error({ error: error.message }, "Fetch messages failed");

      return reply.code(500).send({
        success: false,
        message: "Unexpected server error",
      });
    }
  });
}

module.exports = getMessagesRoute;