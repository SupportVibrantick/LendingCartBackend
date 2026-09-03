/**
 * Sub Broker -> Create Conversation
 */

const {
  findBrokerAdmin,
  findOrCreateSubBrokerBrokerConversation,
} = require("../../../../services/messaging/brokerOfficerConversation");

module.exports = async function createSubBrokerConversation(fastify) {
  fastify.post(
    "/conversations",
    {
      preHandler: [fastify.authenticate, fastify.requireRole(["SUB_BROKER"])],

      schema: {
        tags: ["Sub Broker -> Messaging"],
        summary: "Create conversation for assigned application",

        body: {
          type: "object",
          required: ["loanApplicationId", "chatCategory"],
          properties: {
            loanApplicationId: {
              type: "string",
              format: "uuid",
            },
            chatCategory: {
              type: "string",
              enum: ["PRINCIPAL_BROKER", "LOAN_OFFICER"],
            },
            loanOfficerId: {
              type: "string",
              format: "uuid",
            },
          },
        },
      },
    },

    async (req, reply) => {
      const prisma = fastify.prisma;
      const { loanApplicationId, chatCategory, loanOfficerId } = req.body;

      try {
        const userId = req.user.userId || req.user.id;

        const assignment = await prisma.subBrokerApplication.findFirst({
          where: {
            loanApplicationId,
            subBrokerId: userId,
          },
          include: {
            loanApplication: {
              select: {
                id: true,
                brokerOrgId: true,
                brokerUserId: true,
              },
            },
            assignedBy: {
              select: {
                id: true,
              },
            },
          },
        });

        if (!assignment) {
          return reply.code(403).send({
            success: false,
            message: "Application not assigned to sub broker",
          });
        }

        const loan = assignment.loanApplication;
        let brokerParticipantId = null;

        if (chatCategory === "PRINCIPAL_BROKER") {
          const admin = await findBrokerAdmin(prisma, loan.brokerOrgId);
          brokerParticipantId =
            admin?.id ||
            assignment.assignedById ||
            loan.brokerUserId ||
            null;
        }

        if (chatCategory === "LOAN_OFFICER") {
          const targetOfficerId = loanOfficerId || loan.brokerUserId;

          if (!targetOfficerId) {
            return reply.code(400).send({
              success: false,
              message: "Loan officer not found",
            });
          }

          const assigned =
            loan.brokerUserId === targetOfficerId ||
            Boolean(
              await prisma.loanOfficerApplication.findFirst({
                where: {
                  loanApplicationId,
                  loanOfficerId: targetOfficerId,
                },
                select: { id: true },
              }),
            );

          if (!assigned) {
            return reply.code(400).send({
              success: false,
              message: "Loan officer is not assigned to this application",
            });
          }

          brokerParticipantId = targetOfficerId;
        }

        if (!brokerParticipantId) {
          return reply.code(400).send({
            success: false,
            message: "Broker user not found",
          });
        }

        const conversation = await findOrCreateSubBrokerBrokerConversation(
          prisma,
          {
            loanApplicationId,
            subBrokerId: userId,
            ...(chatCategory === "LOAN_OFFICER"
              ? { loanOfficerId: brokerParticipantId }
              : { brokerAdminId: brokerParticipantId }),
            chatCategory,
          },
        );

        return reply.send({
          success: true,
          message: "Conversation ready",
          data: {
            id: conversation.id,
            type: "SUBBROKER_BROKER",
            chatCategory,
          },
        });
      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            stack: error.stack,
          },
          "Failed to create sub broker conversation",
        );

        return reply.code(500).send({
          success: false,
          message: error.message,
        });
      }
    },
  );
};
