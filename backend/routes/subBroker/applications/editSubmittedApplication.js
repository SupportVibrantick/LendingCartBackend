const fp = require("fastify-plugin");
const { logAudit } = require("../../../services/logger/auditLogger");
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
  normalizeClientEmail,
  resolveActivePortalLoginEmail,
  assertBorrowerPortalEmailAvailable,
  changeBorrowerPortalEmail,
} = require("../../../services/clientPortal/changeBorrowerPortalEmail");

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
      const {
        fields,
        updateBorrowerEmail,
        previousBorrowerEmail,
        newBorrowerEmail,
      } = req.body || {};

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

      const requestedPortalEmail = normalizeClientEmail(
        newBorrowerEmail ||
          fields.find((f) => f?.fieldKey === "email")?.value ||
          fields.find((f) => f?.fieldKey === "preferredEmail")?.value,
      );
      const currentPortalLoginEmail = await resolveActivePortalLoginEmail(
        prisma,
        application.clientId,
      );
      const primaryContact = application.clientId
        ? await prisma.clientContact.findFirst({
            where: { clientId: application.clientId },
            orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
            select: { email: true },
          })
        : null;
      const currentContactEmail = normalizeClientEmail(primaryContact?.email);
      const portalEmailAnchor =
        currentPortalLoginEmail || currentContactEmail || null;
      const shouldUpdatePortalEmail = Boolean(requestedPortalEmail);
      const portalEmailPrevious =
        portalEmailAnchor ||
        normalizeClientEmail(previousBorrowerEmail) ||
        null;

      let portalEmailWarning = null;
      if (shouldUpdatePortalEmail) {
        try {
          await assertBorrowerPortalEmailAvailable(prisma, {
            brokerOrgId: application.brokerOrgId,
            loanApplicationId: applicationId,
            newEmail: requestedPortalEmail,
            previousEmail: portalEmailPrevious,
          });
        } catch (preflightErr) {
          if (updateBorrowerEmail) {
            return reply.code(preflightErr.statusCode || 400).send({
              success: false,
              message: preflightErr.message || "Invalid portal email",
            });
          }
          portalEmailWarning =
            preflightErr.message || "Could not validate portal email";
        }
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

      let portalEmailUpdated = false;
      let updatedPortalEmail = null;
      let portalEmailMerged = false;
      if (shouldUpdatePortalEmail && !portalEmailWarning) {
        try {
          const emailChange = await changeBorrowerPortalEmail(prisma, {
            brokerOrgId: application.brokerOrgId,
            loanApplicationId: applicationId,
            newEmail: requestedPortalEmail,
            previousEmail: portalEmailPrevious,
          });
          portalEmailUpdated = Boolean(emailChange?.changed);
          portalEmailMerged = Boolean(emailChange?.merged);
          updatedPortalEmail =
            emailChange?.email || requestedPortalEmail || null;
        } catch (emailChangeErr) {
          portalEmailWarning =
            portalEmailWarning ||
            emailChangeErr.message ||
            "Application updated but client portal email could not be changed";
          fastify.log.error(
            {
              error: emailChangeErr.message,
              applicationId,
            },
            "Failed to change borrower portal email after co-broker application edit",
          );
        }
      }

      let portalNotify = { sent: false, reason: "not_attempted" };
      const notifyToEmail =
        updatedPortalEmail || requestedPortalEmail || null;
      try {
        portalNotify = await notifyClientPortalAfterApplicationEdit({
          prisma,
          applicationId,
          brokerOrgId: application.brokerOrgId,
          submissionId: result.newSubmission.id,
          forceToEmail: notifyToEmail,
          fallbackEmail: notifyToEmail,
          log: fastify.log,
        });
        if (!portalNotify.sent) {
          portalEmailWarning =
            portalEmailWarning ||
            (portalNotify.reason === "no_email"
              ? "Application updated but no client email was found to send the portal link"
              : "Application updated but client portal email failed to send");
        }
      } catch (mailErr) {
        portalNotify = { sent: false, reason: "error" };
        fastify.log.error(
          {
            error: mailErr.message,
            applicationId,
            submissionId: result.newSubmission.id,
          },
          "Failed to send client portal email after co-broker application edit",
        );
        portalEmailWarning =
          portalEmailWarning ||
          "Application updated but client portal email failed to send";
      }

      const warnings = [
        ...(feeAgreementWarning ? [feeAgreementWarning] : []),
        ...(portalEmailWarning ? [portalEmailWarning] : []),
      ];

      return reply.send({
        success: true,
        message: portalEmailMerged
          ? "Application edited and borrower portals merged for this email"
          : portalEmailUpdated
            ? "Application edited and client portal email updated"
            : "Application edited successfully",
        data: {
          submissionId: result.newSubmission.id,
          ...(warnings.length ? { warnings } : {}),
          portalEmailUpdated,
          portalEmailMerged,
          clientPortalEmailSent: Boolean(portalNotify.sent),
          clientPortalEmailTo: portalNotify.clientEmail || null,
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
