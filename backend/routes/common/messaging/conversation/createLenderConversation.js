const { findBrokerAdmin } = require("../../../../services/messaging/brokerOfficerConversation");
const {
  getOrganizationId,
  isLenderUser,
} = require("../../../../services/messaging/messagingAccess");
const { hasLenderPermission, LENDER_PERMISSION } = require("../../../../utils/lender/lenderPermissions");
const {
  LENDER_CHAT_CATEGORIES,
  createLenderBrokerChannelConversation,
} = require("../../../../services/messaging/lenderBrokerConversation");

module.exports = async function createLenderConversation(fastify) {
  fastify.post(
    "/lender/conversation",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Messaging"],
        summary: "Create or resolve lender broker channel conversation",
        body: {
          type: "object",
          required: ["loanApplicationId", "chatCategory"],
          properties: {
            loanApplicationId: { type: "string", format: "uuid" },
            chatCategory: {
              type: "string",
              enum: ["PRINCIPAL_BROKER", "LOAN_OFFICER"],
            },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const { loanApplicationId, chatCategory } = req.body;

      try {
        if (!req.user || !isLenderUser({ user: req.user })) {
          return reply.code(403).send({
            success: false,
            message: "Lender access only",
          });
        }

        if (!hasLenderPermission(req.user, LENDER_PERMISSION.SEND_CHAT)) {
          return reply.code(403).send({
            success: false,
            message:
              "You do not have permission to start lender conversations.",
          });
        }

        const lenderOrgId = getOrganizationId(req.user);

        if (!lenderOrgId) {
          return reply.code(403).send({
            success: false,
            message: "Access denied",
          });
        }

        const lenderAccess = await prisma.applicationLender.findFirst({
          where: {
            loanApplicationId,
            lenderOrgId,
          },
          select: { id: true, lenderOrgId: true },
        });

        if (!lenderAccess) {
          return reply.code(403).send({
            success: false,
            message: "Access denied",
          });
        }

        const loan = await prisma.loanApplication.findUnique({
          where: { id: loanApplicationId },
          select: {
            id: true,
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

        let brokerParticipantId = null;

        if (chatCategory === LENDER_CHAT_CATEGORIES.PRINCIPAL_BROKER) {
          const principalBroker = await findBrokerAdmin(prisma, loan.brokerOrgId);
          brokerParticipantId = principalBroker?.id || null;
        }

        if (chatCategory === LENDER_CHAT_CATEGORIES.LOAN_OFFICER) {
          brokerParticipantId = loan.brokerUserId;
        }

        if (!brokerParticipantId) {
          return reply.code(400).send({
            success: false,
            message:
              chatCategory === LENDER_CHAT_CATEGORIES.LOAN_OFFICER
                ? "No loan officer assigned to this application"
                : "Principal broker not found",
          });
        }

        const conversation = await createLenderBrokerChannelConversation(
          prisma,
          {
            loanApplicationId,
            applicationLenderId: lenderAccess.id,
            chatCategory,
            brokerParticipantId,
            lenderOrgId: lenderAccess.lenderOrgId,
          },
        );

        return reply.send({
          success: true,
          message: "Conversation ready",
          data: {
            id: conversation.id,
            type: conversation.type,
            chatCategory: conversation.chatCategory || chatCategory,
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          message: error.message || "Failed to create conversation",
        });
      }
    },
  );
};
