/**
 * Broker Admin -> Create Broker ↔ Co-Broker conversation
 */

const {
  findOrCreateSubBrokerBrokerConversation,
} = require("../../../../services/messaging/brokerOfficerConversation");
const { hasRole } = require("../../../../services/messaging/messagingAccess");

module.exports = async function createBrokerSubBrokerConversation(fastify) {
  fastify.post(
    "/conversations/broker-subbroker",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Messaging"],
        summary: "Create broker admin ↔ co-broker conversation",
        body: {
          type: "object",
          required: ["loanApplicationId", "subBrokerId"],
          properties: {
            loanApplicationId: { type: "string", format: "uuid" },
            subBrokerId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const { loanApplicationId, subBrokerId } = req.body;

      try {
        if (
          !req.user ||
          req.user.orgType !== "BROKER" ||
          hasRole(req.user, "BROKER_OFFICER") ||
          hasRole(req.user, "SUB_BROKER")
        ) {
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
          select: { id: true },
        });

        if (!loan) {
          return reply.code(404).send({
            success: false,
            message: "Loan not found",
          });
        }

        const assignment = await prisma.subBrokerApplication.findFirst({
          where: {
            loanApplicationId,
            subBrokerId,
            subBroker: {
              organizationId: brokerOrgId,
              isDeleted: false,
            },
          },
          select: { id: true },
        });

        if (!assignment) {
          return reply.code(400).send({
            success: false,
            message: "Co-broker is not assigned to this application",
          });
        }

        const conversation = await findOrCreateSubBrokerBrokerConversation(
          prisma,
          {
            loanApplicationId,
            subBrokerId,
            brokerAdminId,
            chatCategory: "PRINCIPAL_BROKER",
          },
        );

        return reply.send({
          success: true,
          message: "Conversation ready",
          data: {
            id: conversation.id,
            type: "SUBBROKER_BROKER",
            chatCategory: "PRINCIPAL_BROKER",
          },
        });
      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            stack: error.stack,
          },
          "Failed to create broker-subbroker conversation",
        );

        return reply.code(500).send({
          success: false,
          message: error.message,
        });
      }
    },
  );
};
