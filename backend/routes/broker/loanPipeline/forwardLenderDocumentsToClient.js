const { loadTemplate } = require("../../../utils/email/loadTemplate");
const {
  buildClientLinkEmailData,
} = require("../../../utils/email/emailTemplateData");
const sendMail = require("../../../services/emails/mail");
const {
  notifyClient,
  CLIENT_NOTIFICATION_EVENTS,
} = require("../../../services/notifications/clientNotifications");
const {
  setAutoForwardLenderRequestsToClient,
} = require("../../../services/documents/documentAutoForwardSetting");

/**
 * Notify client that lender-requested documents were forwarded by the broker.
 */
async function notifyClientDocumentsForwarded(prisma, io, loan, logger) {
  const contact =
    loan.client?.contacts?.find((c) => c.isPrimary && c.email) ||
    loan.client?.contacts?.find((c) => c.email);

  const clientEmail = contact?.email;
  const portalLink = `${
    process.env.FRONTEND_URL || "http://localhost:5173"
  }/client-portal`;

  if (clientEmail) {
    try {
      const html = loadTemplate(
        "broker/clientLink",
        buildClientLinkEmailData({
          clientName: loan.client?.legalName,
          uploadLink: portalLink,
          applicationNumber: loan.applicationNumber,
          brokerName: "Your Broker",
          message:
            "Your broker sent document requests for your application. Please upload them in the client portal.",
          preset: "documentsRequested",
        }),
      );

      await sendMail({
        prisma,
        to: clientEmail,
        subject: "Documents Requested for Your Loan Application",
        text: "Your broker has requested documents. Please check the client portal.",
        html,
        idempotencyKey: `broker-send-docs-to-client:${loan.id}:${Date.now()}`,
      });
    } catch (err) {
      logger?.error?.(err, "Failed to email client after document send");
    }
  }

  if (loan.clientId && io) {
    try {
      await notifyClient(prisma, io, {
        clientId: loan.clientId,
        eventType: CLIENT_NOTIFICATION_EVENTS.DOCUMENTS_REQUESTED,
        category: "DOCUMENT",
        subject: `Documents requested for ${loan.applicationNumber}`,
        body: "Your broker sent document requests. Please upload them in the client portal.",
        metadata: {
          applicationId: loan.id,
          applicationNumber: loan.applicationNumber,
        },
      });
    } catch (err) {
      logger?.error?.(err, "Failed to notify client after document send");
    }
  }
}

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function forwardLenderDocumentsToClientRoutes(fastify) {
  // Manual forward one or many lender-requested docs to client
  fastify.post(
    "/submissions/:submissionId/documents/forward-to-client",
    {
      schema: {
        tags: ["Broker -> Loan Pipeline"],
        summary: "Send/forward document requests to the client portal",
        body: {
          type: "object",
          required: ["requirementIds"],
          properties: {
            requirementIds: {
              type: "array",
              items: { type: "string", format: "uuid" },
              minItems: 1,
            },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const brokerOrgId = req.user.organizationId;
        const { submissionId } = req.params;
        const requirementIds = [
          ...new Set(
            (req.body?.requirementIds || []).filter(
              (id) => typeof id === "string" && id.length > 0,
            ),
          ),
        ];

        if (requirementIds.length === 0) {
          return reply.code(400).send({
            success: false,
            message: "Please select at least one document",
          });
        }

        const submission = await prisma.applicationSubmission.findUnique({
          where: { id: submissionId },
          include: {
            application: {
              include: {
                client: { include: { contacts: true } },
              },
            },
          },
        });

        if (!submission) {
          return reply.code(404).send({
            success: false,
            message: "Submission not found",
          });
        }

        if (submission.application.brokerOrgId !== brokerOrgId) {
          return reply.code(403).send({
            success: false,
            message: "Access denied for this loan",
          });
        }

        const loan = submission.application;
        const requirements = await prisma.applicationDocumentRequirement.findMany({
          where: {
            id: { in: requirementIds },
            loanApplicationId: loan.id,
            source: {
              in: ["LENDER_ADDED", "BROKER_ADDED", "SUB_BROKER_ADDED"],
            },
            requiresClientSignature: false,
          },
        });

        if (requirements.length === 0) {
          return reply.code(400).send({
            success: false,
            message: "No eligible documents found to send to the client",
          });
        }

        const toForward = requirements.filter((r) => !r.sentToClientAt);
        const alreadySentCount = requirements.length - toForward.length;

        if (toForward.length > 0) {
          const now = new Date();
          await prisma.applicationDocumentRequirement.updateMany({
            where: { id: { in: toForward.map((r) => r.id) } },
            data: { sentToClientAt: now },
          });
        }

        await notifyClientDocumentsForwarded(
          prisma,
          fastify.io,
          loan,
          fastify.log,
        );

        const messageParts = [];
        if (toForward.length > 0) {
          messageParts.push(
            `${toForward.length} document(s) sent to client`,
          );
        }
        if (alreadySentCount > 0) {
          messageParts.push(
            `${alreadySentCount} already on client portal — client re-notified`,
          );
        }

        return reply.send({
          success: true,
          message: messageParts.join(". ") || "Client notified",
          data: {
            forwardedCount: toForward.length,
            reNotifiedCount: alreadySentCount,
            requirementIds: requirements.map((r) => r.id),
          },
        });
      } catch (error) {
        fastify.log.error({
          error: error.message,
          route: "forward-lender-documents-to-client",
        });

        return reply.code(500).send({
          success: false,
          message: error.message || "Failed to forward documents to client",
        });
      }
    },
  );

  // Toggle auto-forward of lender requests to client
  fastify.patch(
    "/submissions/:submissionId/documents/auto-forward-to-client",
    {
      schema: {
        tags: ["Broker -> Loan Pipeline"],
        summary: "Toggle auto-forward of lender document requests to client",
        body: {
          type: "object",
          required: ["autoForwardLenderRequestsToClient"],
          properties: {
            autoForwardLenderRequestsToClient: { type: "boolean" },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const brokerOrgId = req.user.organizationId;
        const { submissionId } = req.params;
        const { autoForwardLenderRequestsToClient } = req.body;

        const submission = await fastify.prisma.applicationSubmission.findUnique(
          {
            where: { id: submissionId },
            include: { application: true },
          },
        );

        if (!submission) {
          return reply.code(404).send({
            success: false,
            message: "Submission not found",
          });
        }

        if (submission.application.brokerOrgId !== brokerOrgId) {
          return reply.code(403).send({
            success: false,
            message: "Access denied for this loan",
          });
        }

        const updated = await setAutoForwardLenderRequestsToClient(
          fastify.prisma,
          submission.application.id,
          Boolean(autoForwardLenderRequestsToClient),
        );

        return reply.send({
          success: true,
          message: autoForwardLenderRequestsToClient
            ? "Lender document requests will auto-forward to the client"
            : "Broker must manually forward lender document requests to the client",
          data: updated,
        });
      } catch (error) {
        fastify.log.error({
          error: error.message,
          route: "update-auto-forward-lender-requests-to-client",
        });

        return reply.code(500).send({
          success: false,
          message:
            error.message ||
            "Failed to update auto-forward-to-client setting",
        });
      }
    },
  );
}

module.exports = forwardLenderDocumentsToClientRoutes;
