/**
 * Sub Broker -> Create Conversation
 */

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
          },
        },
      },
    },

    async (req, reply) => {
      const prisma = fastify.prisma;

      const { loanApplicationId, chatCategory } = req.body;

      try {
        const userId = req.user.userId;

        /* =====================================
           VERIFY ASSIGNMENT
        ===================================== */

        const assignment = await prisma.subBrokerApplication.findFirst({
          where: {
            loanApplicationId,
            subBrokerId: userId,
          },

          include: {
            loanApplication: {
              select: {
                id: true,
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

        /* =====================================
           EXISTING CONVERSATION
        ===================================== */

        const existingConversation = await prisma.conversation.findFirst({
          where: {
            loanApplicationId,

            type: "SUBBROKER_BROKER",

            chatCategory,

            participants: {
              some: {
                participantId: userId,
                participantType: "SUB_BROKER",
              },
            },
          },
        });

        if (existingConversation) {
          return reply.send({
            success: true,

            message: "Conversation already exists",

            data: {
              id: existingConversation.id,

              type: "SUBBROKER_BROKER",

              chatCategory,
            },
          });
        }
        /* =====================================
           CREATE CONVERSATION
        ===================================== */

        const conversation = await prisma.conversation.create({
          data: {
            loanApplicationId,

            type: "SUBBROKER_BROKER",

            chatCategory,
          },
        });

        const participants = [];

        /* =====================================
           SUB BROKER
        ===================================== */

        participants.push({
          conversationId: conversation.id,

          participantType: "SUB_BROKER",

          participantId: userId,
        });

        let brokerUserId = null;

        if (chatCategory === "PRINCIPAL_BROKER") {
          brokerUserId =
            assignment.assignedById || assignment.loanApplication?.brokerUserId;
        }

        if (chatCategory === "LOAN_OFFICER") {
          brokerUserId = assignment.loanApplication?.brokerUserId;
        }

        if (!brokerUserId) {
          await prisma.conversation.delete({
            where: {
              id: conversation.id,
            },
          });

          return reply.code(400).send({
            success: false,
            message: "Broker user not found",
          });
        }

        participants.push({
          conversationId: conversation.id,

          participantType: "BROKER",

          participantId: brokerUserId,
        });

        /* =====================================
           SAVE PARTICIPANTS
        ===================================== */

        await prisma.conversationParticipant.createMany({
          data: participants,

          skipDuplicates: true,
        });

        return reply.send({
          success: true,

          message: "Conversation created successfully",

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
