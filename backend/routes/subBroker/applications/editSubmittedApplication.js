const fp = require("fastify-plugin");
const { logAudit } = require("../../../services/logger/auditLogger");
const {
  canBrokerEditSubmittedApplication,
} = require("../../../utils/applications/resolveApplicationStatus");
const {
  getFeeAgreementRequestError,
  tryAttachFeeAgreementIfRequested,
} = require("../../../services/feeAgreement/attachFeeAgreementToApplication");

async function editSubmittedApplication(fastify) {
  fastify.put("/:applicationId/edit", async (req, reply) => {
    const prisma = fastify.prisma;

    try {
      const userId = req.user?.userId || req.user?.id;

      if (!userId) {
        return reply.code(401).send({
          success: false,
          message: "Unauthorized",
        });
      }

      const { applicationId } = req.params;
      const { fields } = req.body;

      if (!applicationId) {
        return reply.code(400).send({
          success: false,
          message: "Application ID is required",
        });
      }

      if (!Array.isArray(fields) || fields.length === 0) {
        return reply.code(400).send({
          success: false,
          message: "Fields array is required",
        });
      }

      const feeAgreementError = getFeeAgreementRequestError(req.body);
      if (feeAgreementError) {
        return reply.code(400).send({
          success: false,
          message: feeAgreementError,
        });
      }

      const assignment = await prisma.subBrokerApplication.findFirst({
        where: {
          subBrokerId: userId,
          loanApplicationId: applicationId,
        },
      });

      if (!assignment) {
        return reply.code(403).send({
          success: false,
          message: "You do not have access to this loan application",
        });
      }

      const application = await prisma.loanApplication.findFirst({
        where: { id: applicationId },
        include: {
          applicationLenders: {
            select: { status: true },
          },
          submissions: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      if (!application) {
        return reply.code(404).send({
          success: false,
          message: "Application not found",
        });
      }

      const editCheck = canBrokerEditSubmittedApplication(application);
      if (!editCheck.allowed) {
        return reply.code(400).send({
          success: false,
          message: editCheck.reason,
        });
      }

      const latestSubmission = application.submissions[0];

      if (!latestSubmission) {
        return reply.code(400).send({
          success: false,
          message: "No submission found to edit",
        });
      }

      const result = await prisma.$transaction(async (tx) => {
        const newSubmission = await tx.applicationSubmission.create({
          data: {
            applicationId: application.id,
            applicationProductId: latestSubmission.applicationProductId,
            status: "UPDATED",
          },
        });

        const submissionFields = fields.map((f) => ({
          submissionId: newSubmission.id,
          fieldId: f.fieldId || null,
          fieldKey: f.fieldKey || null,
          value: f.value ?? null,
          source: f.fieldId ? "DYNAMIC" : "STATIC",
        }));

        if (submissionFields.length > 0) {
          await tx.applicationSubmissionField.createMany({
            data: submissionFields,
          });
        }

        await tx.applicationSubmission.update({
          where: { id: latestSubmission.id },
          data: { status: "SUPERSEDED" },
        });

        return { newSubmission };
      });

      await logAudit({
        prisma,
        req,
        dashboard: "SUB_BROKER",
        category: "APPLICATION",
        entityType: "LoanApplication",
        entityId: applicationId,
        action: "EDIT_SUBMITTED_APPLICATION",
        newValue: { submissionId: result.newSubmission.id },
      });

      const feeAgreementWarning = await tryAttachFeeAgreementIfRequested(
        fastify,
        applicationId,
        req.body,
      );

      return reply.send({
        success: true,
        message: "Application edited successfully",
        data: {
          submissionId: result.newSubmission.id,
          ...(feeAgreementWarning ? { warnings: [feeAgreementWarning] } : {}),
        },
      });
    } catch (error) {
      fastify.log.error({
        message: error.message,
        stack: error.stack,
        route: "SUB_BROKER_EDIT_SUBMITTED_APPLICATION",
      });

      return reply.code(500).send({
        success: false,
        message: "Internal server error while editing application",
      });
    }
  });
}

module.exports = fp(editSubmittedApplication);
