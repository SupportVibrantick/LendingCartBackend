const jwt = require("jsonwebtoken");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function createConversationRoute(fastify) {
  fastify.post("/create", async (req, reply) => {
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
      const {
        loanApplicationId,
        applicationLenderId,
        type, // CLIENT_BROKER | BROKER_LENDER
        participants, // [{ userId?, clientUserId?, role }]
      } = req.body;

      if (!type) {
        return reply.code(400).send({
          success: false,
          message: "type is required",
        });
      }

      if (!participants || !participants.length) {
        return reply.code(400).send({
          success: false,
          message: "participants are required",
        });
      }

      /* ===============================
         PREVENT DUPLICATE CONVERSATION
      =============================== */
      let existingConversation = null;

      if (loanApplicationId) {
        existingConversation = await prisma.conversation.findFirst({
          where: {
            loanApplicationId,
            type,
          },
        });
      }

      if (applicationLenderId) {
        existingConversation = await prisma.conversation.findFirst({
          where: {
            applicationLenderId,
            type,
          },
        });
      }

      if (existingConversation) {
        return reply.send({
          success: true,
          data: existingConversation,
          message: "Conversation already exists",
        });
      }

      /* ===============================
         CREATE CONVERSATION
      =============================== */
      const conversation = await prisma.conversation.create({
        data: {
          loanApplicationId: loanApplicationId || null,
          applicationLenderId: applicationLenderId || null,
          type,
          participants: {
            create: participants.map((p) => ({
              userId: p.userId || null,
              clientUserId: p.clientUserId || null,
              role: p.role,
            })),
          },
        },
        include: {
          participants: true,
        },
      });

      /* ===============================
         RESPONSE
      =============================== */
      return reply.send({
        success: true,
        data: conversation,
      });

    } catch (error) {
      fastify.log.error({ error: error.message }, "Create conversation failed");

      return reply.code(500).send({
        success: false,
        message: "Unexpected server error",
      });
    }
  });
}

module.exports = createConversationRoute;