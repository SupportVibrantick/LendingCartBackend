/**
 * @param {import("fastify").FastifyInstance} fastify
 */

const {
  notifyBroker,
  BROKER_NOTIFICATION_EVENTS,
} = require("../../../services/notifications/brokerNotifications");

module.exports = async function sendToPrincipalBroker(fastify) {
  fastify.post(
    "/:requirementId/send-to-broker",
    {
      preHandler: [fastify.authenticate],

      schema: {
        tags: ["Sub Broker Documents"],
        summary: "Send document to Principal Broker",

        params: {
          type: "object",
          required: ["requirementId"],

          properties: {
            requirementId: {
              type: "string",
              format: "uuid",
            },
          },
        },
      },
    },

    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        /* =========================================
           AUTH
        ========================================= */

        const roles = Array.isArray(req.user?.roles)
          ? req.user.roles
          : [req.user?.role];

        if (!roles.includes("SUB_BROKER")) {
          return reply.code(403).send({
            success: false,
            message: "Sub broker access only",
          });
        }

        const subBrokerOrgId = req.user.organizationId;

        const { requirementId } = req.params;

        /* =========================================
           FETCH REQUIREMENT
        ========================================= */

        const requirement =
          await prisma.applicationDocumentRequirement.findUnique({
            where: {
              id: requirementId,
            },

            include: {
              loanApplication: true,

              uploads: {
                orderBy: {
                  uploadedAt: "desc",
                },
              },

              documentType: true,
            },
          });

        if (!requirement) {
          return reply.code(404).send({
            success: false,
            message: "Document requirement not found",
          });
        }

        /* =========================================
           VALIDATE SOURCE
        ========================================= */

        if (requirement.source !== "SUB_BROKER_ADDED") {
          return reply.code(400).send({
            success: false,
            message: "Only sub broker documents can be sent",
          });
        }

        /* =========================================
           VALIDATE OWNERSHIP
        ========================================= */
        const assignment = await prisma.subBrokerApplication.findFirst({
          where: {
            loanApplicationId: requirement.loanApplicationId,

            subBrokerId: req.user.userId,
          },
        });

        if (!assignment) {
          return reply.code(403).send({
            success: false,
            message: "You do not have access to this loan",
          });
        }

        /* =========================================
           VALIDATE FILES
        ========================================= */

        if (!requirement.uploads.length) {
          return reply.code(400).send({
            success: false,
            message: "Please upload documents first",
          });
        }

        /* =========================================
           ALREADY SENT
        ========================================= */

        if (requirement.isSentToBroker) {
          return reply.code(400).send({
            success: false,
            message: "Document already sent to Principal Broker",
          });
        }

        /* =========================================
           UPDATE REQUIREMENT
        ========================================= */

        const uploads = requirement.uploads;

        const result = await prisma.$transaction(async (tx) => {
          /* =========================
         UPDATE REQUIREMENT
      ========================= */

          const updatedRequirement =
            await tx.applicationDocumentRequirement.update({
              where: {
                id: requirement.id,
              },

              data: {
                isSentToBroker: true,

                sentToBrokerAt: new Date(),

                status: "PARTIAL",

                requestedBySubBrokerId:
                  requirement.requestedBySubBrokerId || req.user.userId,
              },
            });

          /* =========================
         CREATE SUBMISSION
      ========================= */

          const createdSubmissions = [];

          for (const upload of uploads) {
            const submission = await tx.subBrokerSubmission.create({
              data: {
                loanApplicationId: requirement.loanApplicationId,

                documentUploadId: upload.id,

                submittedBySubBrokerId: req.user.userId,

                principalBrokerId: assignment.assignedById,

                status: "PENDING",
              },
            });

            createdSubmissions.push(submission);
          }

          return {
            updatedRequirement,
            submissions: createdSubmissions,
          };
        });

        /* =========================================
           LOG
        ========================================= */

        fastify.log.info(
          {
            requirementId: requirement.id,

            loanApplicationId: requirement.loanApplicationId,

            documentType: requirement.documentType?.name,

            subBrokerOrgId,
          },
          "Document sent to Principal Broker",
        );

        const subBrokerUser = await prisma.userAccount.findUnique({
          where: { id: req.user.userId || req.user.id },
          select: { firstName: true, lastName: true },
        });

        const subBrokerName =
          `${subBrokerUser?.firstName || ""} ${subBrokerUser?.lastName || ""}`.trim() ||
          "Sub-Broker";

        await notifyBroker(prisma, fastify.io, {
          brokerOrgId: requirement.loanApplication.brokerOrgId,
          eventType: BROKER_NOTIFICATION_EVENTS.SUBBROKER_DOCUMENT_SENT,
          category: "DOCUMENT",
          subject: "Sub-Broker Document Received",
          body: `${subBrokerName} sent ${requirement.documentType?.name || "documents"} for application ${requirement.loanApplication.applicationNumber}`,
          metadata: {
            applicationId: requirement.loanApplicationId,
            applicationNumber: requirement.loanApplication.applicationNumber,
            requirementId: requirement.id,
            documentType: requirement.documentType?.name || null,
            subBrokerId: req.user.userId || req.user.id,
            subBrokerName,
          },
        });

        /* =========================================
           RESPONSE
        ========================================= */

        return reply.send({
          success: true,

          message: "Document sent to Principal Broker successfully",

          data: {
            requirementId: result.updatedRequirement.id,

            isSentToBroker: result.updatedRequirement.isSentToBroker,

            sentToBrokerAt: result.updatedRequirement.sentToBrokerAt,
          },
        });
      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            stack: error.stack,
            route: "send-to-principal-broker",
          },
          "Failed to send document to Principal Broker",
        );

        return reply.code(500).send({
          success: false,
          message: error.message,
        });
      }
    },
  );
};
