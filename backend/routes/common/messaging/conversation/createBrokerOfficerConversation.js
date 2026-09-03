/**
 * Broker Admin -> Create Broker ↔ Loan Officer conversation
 */

const {
  findOrCreateBrokerOfficerConversation,
  buildBrokerOfficerCategory,
} = require("../../../../services/messaging/brokerOfficerConversation");
const { hasRole } = require("../../../../services/messaging/messagingAccess");

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
            loanOfficerId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const { loanApplicationId, loanOfficerId: requestedOfficerId } =
        req.body;

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

        const loanOfficerId = requestedOfficerId || loan.brokerUserId;

        if (!loanOfficerId) {
          return reply.code(400).send({
            success: false,
            message: "No loan officer assigned to this application",
          });
        }

        const assignedOfficer =
          (await prisma.loanOfficerApplication.findFirst({
            where: {
              loanApplicationId,
              loanOfficerId,
            },
            select: { id: true },
          })) ||
          (loan.brokerUserId === loanOfficerId ? { id: loanOfficerId } : null);

        if (!assignedOfficer) {
          return reply.code(400).send({
            success: false,
            message: "Loan officer is not assigned to this application",
          });
        }

        const officer = await prisma.userAccount.findFirst({
          where: {
            id: loanOfficerId,
            organizationId: brokerOrgId,
            roles: {
              some: { role: { name: "BROKER_OFFICER" } },
            },
          },
          select: { id: true },
        });

        if (!officer) {
          return reply.code(400).send({
            success: false,
            message: "Invalid loan officer",
          });
        }

        const conversation = await findOrCreateBrokerOfficerConversation(prisma, {
          loanApplicationId,
          brokerAdminId,
          loanOfficerId,
        });

        return reply.send({
          success: true,
          message: "Conversation ready",
          data: {
            id: conversation.id,
            type: "BROKER_OFFICER",
            chatCategory: buildBrokerOfficerCategory(loanOfficerId),
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
