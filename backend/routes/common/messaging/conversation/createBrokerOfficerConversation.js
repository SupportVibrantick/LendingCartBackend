/**
 * Broker Admin -> Create Broker ↔ Loan Officer conversation
 */

const {
  findOrCreateBrokerOfficerConversation,
} = require("../../../../services/messaging/brokerOfficerConversation");

module.exports = async function createBrokerOfficerConversation(fastify) {
  fastify.post(
    "/conversations/broker-officer",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Messaging"],
        summary: "Create broker admin ↔ loan officer conversation",
        body: {
          type: "object",
          required: ["loanApplicationId"],
          properties: {
            loanApplicationId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const { loanApplicationId } = req.body;

      try {
        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const brokerOrgId = req.user.organizationId;
        const brokerAdminId = req.user.id || req.user.userId;

        const loan = await prisma.loanApplication.findFirst({
          where: {
            id: loanApplicationId,
            brokerOrgId,
          },
          select: {
            id: true,
            brokerUserId: true,
          },
        });

        if (!loan) {
          return reply.code(404).send({
            success: false,
            message: "Loan not found",
          });
        }

        if (!loan.brokerUserId) {
          return reply.code(400).send({
            success: false,
            message: "No loan officer assigned to this application",
          });
        }

        const conversation = await findOrCreateBrokerOfficerConversation(prisma, {
          loanApplicationId,
          brokerAdminId,
          loanOfficerId: loan.brokerUserId,
        });

        return reply.send({
          success: true,
          message: "Conversation ready",
          data: {
            id: conversation.id,
            type: "BROKER_OFFICER",
          },
        });
      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            stack: error.stack,
          },
          "Failed to create broker-officer conversation",
        );

        return reply.code(500).send({
          success: false,
          message: error.message,
        });
      }
    },
  );
};
