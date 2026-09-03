/**
 * Loan Officer -> Create Broker ↔ Loan Officer conversation
 */

const {
  findBrokerAdmin,
  findOrCreateBrokerOfficerConversation,
} = require("../../../../services/messaging/brokerOfficerConversation");
const {
  extraOfficerPermission,
  LOAN_OFFICER_MESSAGING_PERMISSIONS,
  officerAssignedApplicationWhere,
} = require("../../../../services/broker/loanOfficerAccess");

module.exports = async function createBrokerOfficerConversation(fastify) {
  fastify.post(
    "/conversations/broker-officer",
    {
      preHandler: extraOfficerPermission(fastify, LOAN_OFFICER_MESSAGING_PERMISSIONS),
      schema: {
        tags: ["Loan Officer -> Messaging"],
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
        const userId = req.user?.id || req.user?.userId;
        const brokerOrgId = req.user?.organizationId;

        const loan = await prisma.loanApplication.findFirst({
          where: {
            id: loanApplicationId,
            brokerOrgId,
            ...officerAssignedApplicationWhere(userId),
          },
          select: {
            id: true,
            brokerUserId: true,
            brokerOrgId: true,
          },
        });

        if (!loan) {
          return reply.code(403).send({
            success: false,
            message: "Access denied - not assigned to you",
          });
        }

        const brokerAdmin = await findBrokerAdmin(prisma, brokerOrgId);

        if (!brokerAdmin) {
          return reply.code(400).send({
            success: false,
            message: "Broker admin not found",
          });
        }

        const conversation = await findOrCreateBrokerOfficerConversation(prisma, {
          loanApplicationId,
          brokerAdminId: brokerAdmin.id,
          loanOfficerId: userId,
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
