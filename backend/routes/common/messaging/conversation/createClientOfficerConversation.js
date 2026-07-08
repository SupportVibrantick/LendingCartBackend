/**
 * Create Client ↔ Loan Officer conversation
 */

const {
  findOrCreateClientOfficerConversation,
} = require("../../../../services/messaging/brokerOfficerConversation");
const {
  isClientUser,
  hasRole,
  getUserId,
} = require("../../../../services/messaging/messagingAccess");

module.exports = async function createClientOfficerConversation(fastify) {
  fastify.post(
    "/conversations/client-officer",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Messaging"],
        summary: "Create client ↔ loan officer conversation",
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
        if (!req.user) {
          return reply.code(401).send({
            success: false,
            message: "Unauthorized",
          });
        }

        const loan = await prisma.loanApplication.findUnique({
          where: { id: loanApplicationId },
          select: {
            id: true,
            clientId: true,
            brokerOrgId: true,
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

        if (isClientUser(req)) {
          if (loan.clientId !== req.user.clientId) {
            return reply.code(403).send({
              success: false,
              message: "Access denied",
            });
          }
        } else if (req.user.orgType === "BROKER") {
          if (loan.brokerOrgId !== req.user.organizationId) {
            return reply.code(403).send({
              success: false,
              message: "Access denied",
            });
          }

          if (
            hasRole(req.user, "BROKER_OFFICER") &&
            loan.brokerUserId !== getUserId(req.user)
          ) {
            return reply.code(403).send({
              success: false,
              message: "Access denied - not assigned to you",
            });
          }
        } else {
          return reply.code(403).send({
            success: false,
            message: "Access denied",
          });
        }

        const conversation = await findOrCreateClientOfficerConversation(prisma, {
          loanApplicationId,
          loanOfficerId: loan.brokerUserId,
          clientId: loan.clientId,
        });

        return reply.send({
          success: true,
          message: "Conversation ready",
          data: {
            id: conversation.id,
            type: "CLIENT_OFFICER",
          },
        });
      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            stack: error.stack,
          },
          "Failed to create client-officer conversation",
        );

        return reply.code(500).send({
          success: false,
          message: error.message,
        });
      }
    },
  );
};
