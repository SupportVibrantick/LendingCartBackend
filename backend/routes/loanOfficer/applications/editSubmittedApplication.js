const fp = require("fastify-plugin");
const { logAudit } = require("../../../services/logger/auditLogger");
const {
  getUserId,
  officerPreHandler,
  officerAssignedApplicationWhere,
} = require("../../../services/broker/loanOfficerAccess");
const {
  canBrokerEditSubmittedApplication,
} = require("../../../utils/applications/resolveApplicationStatus");
const {
  getFeeAgreementRequestError,
  tryAttachFeeAgreementIfRequested,
} = require("../../../services/feeAgreement/attachFeeAgreementToApplication");
const {
  buildLoanApplicationSyncFromFields,
} = require("../../../utils/applications/resolveRequestedAmount");
const {
  notifyClientPortalAfterApplicationEdit,
} = require("../../../services/emails/notifyClientPortalAfterEdit");
const {
  changeBorrowerPortalEmail,
} = require("../../../services/clientPortal/changeBorrowerPortalEmail");

async function editSubmittedApplication(fastify) {
  fastify.put("/:applicationId/edit", {
    preHandler: officerPreHandler(fastify, "EDIT_APPLICATION"),
  }, async (req, reply) => {
    const prisma = fastify.prisma;

    try {
      if (!req.user || req.user.orgType !== "BROKER") {
        return reply.code(403).send({ success: false, message: "Broker access only" });
      }

      const brokerOrgId = req.user.organizationId;
      const userId = getUserId(req);
      const { applicationId } = req.params;
      const {
        fields,
        updateBorrowerEmail,
        previousBorrowerEmail,
        newBorrowerEmail,
      } = req.body || {};

      if (!applicationId) {
        return reply.code(400).send({ success: false, message: "Application ID is required" });
      }

      if (!Array.isArray(fields) || fields.length === 0) {
        return reply.code(400).send({ success: false, message: "Fields array is required" });
      }

      const feeAgreementError = getFeeAgreementRequestError(req.body);
      if (feeAgreementError) {
        return reply.code(400).send({
          success: false,
          message: feeAgreementError,
        });
      }

      const application = await prisma.loanApplication.findFirst({
        where: {
          id: applicationId,
          brokerOrgId,
          ...officerAssignedApplicationWhere(userId),
        },
        include: {
          applicationLenders: {
            select: { status: true },
          },
          submissions: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      });

      if (!application) {
        return reply.code(404).send({
          success: false,
          message: "Application not found or unauthorized",
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
        return reply.code(400).send({ success: false, message: "No submission found to edit" });
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
          await tx.applicationSubmissionField.createMany({ data: submissionFields });
        }

        await tx.applicationSubmission.update({
          where: { id: latestSubmission.id },
          data: { status: "SUPERSEDED" },
        });

        const loanUpdate = buildLoanApplicationSyncFromFields(fields);
        if (Object.keys(loanUpdate).length > 0) {
          await tx.loanApplication.update({
            where: { id: application.id },
            data: loanUpdate,
          });
        }

        return { newSubmission };
      });

      await logAudit({
        prisma,
        req,
        dashboard: "BROKER",
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

      let portalEmailWarning = null;
      if (updateBorrowerEmail) {
        try {
          const fieldEmail =
            newBorrowerEmail ||
            fields.find((f) => f?.fieldKey === "email")?.value;
          await changeBorrowerPortalEmail(prisma, {
            brokerOrgId,
            loanApplicationId: applicationId,
            newEmail: fieldEmail,
            previousEmail: previousBorrowerEmail,
          });
        } catch (emailChangeErr) {
          portalEmailWarning =
            emailChangeErr.message ||
            "Application updated but client portal email could not be changed";
          fastify.log.error(
            {
              error: emailChangeErr.message,
              applicationId,
            },
            "Failed to change borrower portal email after LO application edit",
          );
        }
      }

      try {
        await notifyClientPortalAfterApplicationEdit({
          prisma,
          applicationId,
          brokerOrgId,
          submissionId: result.newSubmission.id,
          log: fastify.log,
        });
      } catch (mailErr) {
        fastify.log.error(
          {
            error: mailErr.message,
            applicationId,
            submissionId: result.newSubmission.id,
          },
          "Failed to enqueue client portal email after LO application edit",
        );
      }

      const warnings = [
        ...(feeAgreementWarning ? [feeAgreementWarning] : []),
        ...(portalEmailWarning ? [portalEmailWarning] : []),
      ];

      return reply.send({
        success: true,
        message: updateBorrowerEmail
          ? "Application edited and client portal email updated"
          : "Application edited successfully",
        data: {
          submissionId: result.newSubmission.id,
          ...(warnings.length ? { warnings } : {}),
          portalEmailUpdated: Boolean(
            updateBorrowerEmail && !portalEmailWarning,
          ),
        },
      });
    } catch (error) {
      fastify.log.error({ message: error.message, stack: error.stack });
      return reply.code(500).send({
        success: false,
        message: "Internal server error while editing application",
      });
    }
  });
}

module.exports = fp(editSubmittedApplication);
