const jwt = require("jsonwebtoken");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function getConversationsRoute(fastify) {
  fastify.get("/conversations", async (req, reply) => {
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
         IDENTIFY USER
      =============================== */
      let userFilter = {};

      if (decoded.role === "CLIENT") {
        userFilter = {
          clientUserId: decoded.clientId,
        };
      } else {
        // BROKER / LENDER / ADMIN (UserAccount आधारित)
        userFilter = {
          userId: decoded.userId,
        };
      }

      /* ===============================
         FETCH CONVERSATIONS
      =============================== */
      const conversations = await prisma.conversation.findMany({
        where: {
          participants: {
            some: userFilter,
          },
        },
        include: {
          participants: true,
          messages: {
            take: 1,
            orderBy: { createdAt: "desc" }, // last message
          },
        },
        orderBy: {
          lastMessageAt: "desc",
        },
      });

      /* ===============================
         RESPONSE
      =============================== */
      return reply.send({
        success: true,
        data: conversations,
      });

    } catch (error) {
      fastify.log.error({ error: error.message }, "Fetch conversations failed");

      return reply.code(500).send({
        success: false,
        message: "Unexpected server error",
      });
    }
  });
}

module.exports = getConversationsRoute;