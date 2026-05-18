/**
 * Get single sub-broker conversation details
 */

const DB_TO_API_TYPE = {
  CLIENT_BROKER: "SUBBROKER_BROKER",
};

module.exports = async function getConversationById(fastify) {
  fastify.get(
    "/conversation/:conversationId",
    {
      preHandler: [fastify.authenticate, fastify.requireRole(["SUB_BROKER"])],
      schema: {
        tags: ["Sub Broker -> Messaging"],
        summary: "Get sub-broker conversation details",
        params: {
          type: "object",
          required: ["conversationId"],
          properties: {
            conversationId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const { conversationId } = req.params;
      const userId = req.user?.userId;

      try {
        const conversation = await prisma.conversation.findFirst({
          where: {
            id: conversationId,
            type: "CLIENT_BROKER",
            participants: {
              some: {
                participantId: userId,
                participantType: "SUB_BROKER",
              },
            },
          },
          select: {
            id: true,
            type: true,
            loanApplicationId: true,
            applicationLenderId: true,
            lastMessageAt: true,
            createdAt: true,
            participants: true,
          },
        });

        if (!conversation) {
          return reply.code(404).send({
            success: false,
            message: "Conversation not found",
          });
        }

        const participantIds = conversation.participants
          .filter((participant) => participant.participantId)
          .map((participant) => participant.participantId);

        const users = participantIds.length
          ? await prisma.userAccount.findMany({
              where: {
                id: {
                  in: participantIds,
                },
              },
              select: {
                id: true,
                firstName: true,
                lastName: true,
                organization: {
                  select: {
                    name: true,
                  },
                },
              },
            })
          : [];

        const userMap = new Map(users.map((user) => [user.id, user]));

        let title = "Conversation";
        const apiType = DB_TO_API_TYPE[conversation.type] || conversation.type;

        if (apiType === "SUBBROKER_BROKER") {
          const brokerNames = conversation.participants
            .filter((participant) => participant.participantType === "BROKER")
            .map((participant) => {
              const user = userMap.get(participant.participantId);
              return `${user?.firstName || ""} ${user?.lastName || ""}`.trim();
            })
            .filter(Boolean);

          title = brokerNames.length
            ? `Broker Chat - ${brokerNames.join(", ")}`
            : "Broker Chat";
        }

        const participants = conversation.participants.map((participant) => {
          const user = userMap.get(participant.participantId);
          return {
            ...participant,
            name:
              `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
              user?.organization?.name ||
              participant.participantType,
          };
        });

        return reply.send({
          success: true,
          data: {
            id: conversation.id,
            type: apiType,
            loanApplicationId: conversation.loanApplicationId,
            applicationLenderId: conversation.applicationLenderId,
            title,
            participants,
            lastMessageAt: conversation.lastMessageAt,
            createdAt: conversation.createdAt,
          },
        });
      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            conversationId,
            userId,
          },
          "Failed to fetch sub-broker conversation"
        );

        return reply.code(500).send({
          success: false,
          message: error.message,
        });
      }
    }
  );
};
