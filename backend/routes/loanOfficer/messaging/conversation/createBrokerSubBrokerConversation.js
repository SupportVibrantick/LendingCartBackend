/**
 * Loan Officer -> Create Loan Officer ↔ Co-Broker conversation
 */

const {
  findOrCreateSubBrokerBrokerConversation,
} = require("../../../../services/messaging/brokerOfficerConversation");
const {
  extraOfficerPermission,
  LOAN_OFFICER_MESSAGING_PERMISSIONS,
  officerAssignedApplicationWhere,
  getUserId,
} = require("../../../../services/broker/loanOfficerAccess");

module.exports = async function createBrokerSubBrokerConversation(fastify) {
  fastify.post(
    "/conversations/broker-subbroker",
    {
      preHandler: extraOfficerPermission(
        fastify,
        LOAN_OFFICER_MESSAGING_PERMISSIONS,
      ),
      schema: {
        tags: ["Loan Officer -> Messaging"],
        summary: "Create loan officer ↔ co-broker conversation",
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
        const loanOfficerId = getUserId(req);
        const brokerOrgId = req.user?.organizationId;

        const loan = await prisma.loanApplication.findFirst({
          where: {
            id: loanApplicationId,
            brokerOrgId,
            ...officerAssignedApplicationWhere(loanOfficerId),
          },
          select: { id: true },
        });

        if (!loan) {
          return reply.code(403).send({
            success: false,
            message: "Access denied - not assigned to you",
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
            loanOfficerId,
            chatCategory: "LOAN_OFFICER",
          },
        );

        return reply.send({
          success: true,
          message: "Conversation ready",
          data: {
            id: conversation.id,
            type: "SUBBROKER_BROKER",
            chatCategory: "LOAN_OFFICER",
          },
        });
      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            stack: error.stack,
          },
          "Failed to create loan-officer subbroker conversation",
        );

        return reply.code(500).send({
          success: false,
          message: error.message,
        });
      }
    },
  );
};
