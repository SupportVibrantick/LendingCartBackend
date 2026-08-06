/**
 * Create conversation (INTERNAL USE)
 */

const { extraOfficerPermission, LOAN_OFFICER_MESSAGING_PERMISSIONS } = require("../../../../services/broker/loanOfficerAccess");

module.exports = async function createConversation(fastify) {
  fastify.post(
    "/conversation",
    {
      preHandler: extraOfficerPermission(fastify, LOAN_OFFICER_MESSAGING_PERMISSIONS),
      schema: {
        tags: ["Messaging"],
        summary: "Create conversation (internal)",
        body: {
          type: "object",
          required: ["loanApplicationId", "type"],
          properties: {
            loanApplicationId: { type: "string", format: "uuid" },
            applicationLenderId: { type: "string", format: "uuid" },
            type: {
              type: "string",
              enum: ["CLIENT_BROKER", "BROKER_LENDER"],
            },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const { loanApplicationId, applicationLenderId, type } = req.body;

      try {
        /* =====================================================
           1️⃣ AUTH CHECK (only broker should create)
        ===================================================== */

        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Only broker can create conversations",
          });
        }

        /* =====================================================
           2️⃣ FETCH LOAN
        ===================================================== */

        const loan = await prisma.loanApplication.findUnique({
          where: { id: loanApplicationId },
include: {
  client: {
    include: {
      contacts: {
        where: {
          isPrimary: true,
        },
        take: 1,
      },
    },
  },
},
        });

        if (!loan) {
          return reply.code(404).send({
            success: false,
            message: "Loan not found",
          });
        }

        if (loan.brokerOrgId !== req.user.organizationId) {
          return reply.code(403).send({
            success: false,
            message: "Access denied",
          });
        }

        /* =====================================================
           3️⃣ HANDLE TYPE VALIDATION
        ===================================================== */

        if (type === "CLIENT_BROKER") {
          // ensure only one exists
          const existing = await prisma.conversation.findFirst({
            where: {
              loanApplicationId,
              type: "CLIENT_BROKER",
            },
          });

          if (existing) {
            return reply.send({
              success: true,
              message: "Conversation already exists",
              data: existing,
            });
          }
        }

        if (type === "BROKER_LENDER") {
          if (!applicationLenderId) {
            return reply.code(400).send({
              success: false,
              message: "applicationLenderId is required",
            });
          }

          const existing = await prisma.conversation.findFirst({
            where: {
              applicationLenderId,
            },
          });

          if (existing) {
            return reply.send({
              success: true,
              message: "Conversation already exists",
              data: existing,
            });
          }
        }

        /* =====================================================
           4️⃣ CREATE CONVERSATION
        ===================================================== */

        const conversation = await prisma.conversation.create({
          data: {
            loanApplicationId,
            applicationLenderId:
              type === "BROKER_LENDER" ? applicationLenderId : null,
            type
          },
        });

        /* =====================================================
           5️⃣ ADD PARTICIPANTS
        ===================================================== */

        const participants = [];

        // BROKER USERS (you can expand to team later)
        participants.push({
          conversationId: conversation.id,
          participantType: "BROKER",
          participantId: req.user.userId,
        });

        // CLIENT CHAT
        if (type === "CLIENT_BROKER") {
          const clientUsers = await prisma.clientPortalUser.findMany({
            where: {
              clientId: loan.clientId,
              isDeleted: false,
            },
            select: { id: true },
          });

          clientUsers.forEach((u) => {
            participants.push({
              conversationId: conversation.id,
              participantType: "CLIENT",
              participantId: u.id,
            });
          });
        }

        // LENDER CHAT
        if (type === "BROKER_LENDER") {
          const appLender = await prisma.applicationLender.findUnique({
            where: { id: applicationLenderId },
            include: {
              lender: {
                include: {
                  users: {
                    select: { id: true },
                  },
                },
              },
            },
          });

          appLender?.lender?.users?.forEach((u) => {
            participants.push({
              conversationId: conversation.id,
              participantType: "LENDER",
              participantId: u.id,
            });
          });
        }

        // BULK INSERT
        if (participants.length > 0) {
          await prisma.conversationParticipant.createMany({
            data: participants,
          });
        }

        /* =====================================================
           6️⃣ RESPONSE
        ===================================================== */

        return reply.send({
          success: true,
          message: "Conversation created successfully",
          data: {
            id: conversation.id,
            type: conversation.type,
          },
        });
      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            loanApplicationId,
            applicationLenderId,
          },
          "Failed to create conversation",
        );

        return reply.code(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    },
  );
};
