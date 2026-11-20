const fp = require("fastify-plugin");
const { logAudit } = require("../../../services/logger/auditLogger");
const {
  canBrokerEditSubmittedApplication,
} = require("../../../utils/applications/resolveApplicationStatus");
const {
  sanitizeRequestedDocumentTypes,
} = require("../../../utils/applications/sanitizeRequestedDocumentTypes");
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
  fastify.put(
    "/:applicationId/edit",
    {
      schema: {
        tags: ["Broker -> Applications"],
        summary: "Edit Submitted Loan Application"
      }
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        /* ================= AUTH ================= */

        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only"
          });
        }

        const brokerOrgId = req.user.organizationId;
        const { applicationId } = req.params;
        const {
          fields,
          requestedDocumentTypes,
          updateBorrowerEmail,
          previousBorrowerEmail,
          newBorrowerEmail,
        } = req.body || {};

        /* ================= VALIDATION ================= */

        if (!applicationId) {
          return reply.code(400).send({
            success: false,
            message: "Application ID is required"
          });
        }

        if (!Array.isArray(fields) || fields.length === 0) {
          return reply.code(400).send({
            success: false,
            message: "Fields array is required"
          });
        }

        // requestedDocumentTypes is optional on edit. Pass `null` or omit
        // to clear the selection; pass an object to overwrite.
        const hasRequestedDocumentTypesUpdate =
          requestedDocumentTypes !== undefined;
        const sanitizedRequestedDocumentTypes = hasRequestedDocumentTypesUpdate
          ? sanitizeRequestedDocumentTypes(requestedDocumentTypes)
          : undefined;

        const feeAgreementError = getFeeAgreementRequestError(req.body);
        if (feeAgreementError) {
          return reply.code(400).send({
            success: false,
            message: feeAgreementError,
          });
        }

        /* ================= FETCH APPLICATION ================= */

        const application = await prisma.loanApplication.findFirst({
          where: {
            id: applicationId,
            brokerOrgId
          },
          include: {
            applicationLenders: {
              select: { status: true },
            },
            submissions: {
              orderBy: { createdAt: "desc" },
              take: 1
            }
          }
        });

        if (!application) {
          return reply.code(404).send({
            success: false,
            message: "Application not found or unauthorized"
          });
        }

        /* ================= BUSINESS RULES ================= */

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
            message: "No submission found to edit"
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
        // One email → one portal: always sync/merge when an email is present
        // (conflict merges into the existing portal instead of 409).
        const shouldUpdatePortalEmail = Boolean(requestedPortalEmail);
        const portalEmailPrevious =
          portalEmailAnchor ||
          normalizeClientEmail(previousBorrowerEmail) ||
          null;

        let portalEmailWarning = null;
        if (shouldUpdatePortalEmail) {
          try {
            await assertBorrowerPortalEmailAvailable(prisma, {
              brokerOrgId,
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

        /* ================= TRANSACTION ================= */

        const result = await prisma.$transaction(async (tx) => {
          /* 1️⃣ Create NEW submission version */

          const newSubmission = await tx.applicationSubmission.create({
            data: {
              applicationId: application.id,
              applicationProductId: latestSubmission.applicationProductId,
              status: application.status === "DRAFT" ? "CLIENT_PENDING" : "UPDATED",
            }
          });

          /* 2️⃣ Prepare fields */

          const submissionFields = fields.map((f) => ({
            submissionId: newSubmission.id,
            fieldId: f.fieldId || null,
            fieldKey: f.fieldKey || null,
            value: f.value ?? null,
            source: f.fieldId ? "DYNAMIC" : "STATIC"
          }));

          /* 3️⃣ Insert fields */

          if (submissionFields.length > 0) {
            await tx.applicationSubmissionField.createMany({
              data: submissionFields
            });
          }

          /* 4️⃣ (Optional but recommended) mark old submission */

          await tx.applicationSubmission.update({
            where: { id: latestSubmission.id },
            data: { status: "SUPERSEDED" }
          });

          /* 5️⃣ Keep denormalized loan columns in sync.
                Other portals read both the latest submission and these columns. */
          const loanUpdate = buildLoanApplicationSyncFromFields(fields);

          if (hasRequestedDocumentTypesUpdate) {
            loanUpdate.requestedDocumentTypes =
              sanitizedRequestedDocumentTypes ?? null;
          }

          if (Object.keys(loanUpdate).length > 0) {
            await tx.loanApplication.update({
              where: { id: application.id },
              data: loanUpdate,
            });
          }

          return { newSubmission };
        });

        /* ================= AUDIT ================= */

        await logAudit({
          prisma,
          req,
          dashboard: "BROKER",
          category: "APPLICATION",
          entityType: "LoanApplication",
          entityId: applicationId,
          action: "EDIT_SUBMITTED_APPLICATION",
          newValue: {
            submissionId: result.newSubmission.id
          }
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
              brokerOrgId,
              loanApplicationId: applicationId,
              newEmail: requestedPortalEmail,
              previousEmail: portalEmailPrevious,
            });
            portalEmailUpdated = Boolean(emailChange?.changed);
            portalEmailMerged = Boolean(emailChange?.merged);
            updatedPortalEmail =
              emailChange?.email || requestedPortalEmail || null;
            if (portalEmailMerged) {
              fastify.log.info(
                {
                  applicationId,
                  clientId: emailChange?.clientId,
                  email: updatedPortalEmail,
                  movedApplications: emailChange?.movedApplications,
                  absorbedClientIds: emailChange?.absorbedClientIds,
                },
                "Merged borrower clients into one portal for email",
              );
            }
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
              "Failed to change borrower portal email after application edit",
            );
          }
        }

        let portalNotify = { sent: false, reason: "not_attempted" };
        // Always deliver to the email shown/saved on this edit (form field),
        // never a stale contact/portal login that drifted behind the form.
        const notifyToEmail =
          updatedPortalEmail || requestedPortalEmail || null;
        try {
          portalNotify = await notifyClientPortalAfterApplicationEdit({
            prisma,
            applicationId,
            brokerOrgId,
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
            "Failed to send client portal email after application edit",
          );
          portalEmailWarning =
            portalEmailWarning ||
            "Application updated but client portal email failed to send";
        }

        /* ================= SUCCESS ================= */

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
          }
        });

      } catch (error) {
        /* ================= ERROR HANDLING ================= */

        fastify.log.error({
          message: error.message,
          stack: error.stack,
          route: "EDIT_SUBMITTED_APPLICATION",
          userId: req.user?.id
        });

        return reply.code(500).send({
          success: false,
          message: "Internal server error while editing application"
        });
      }
    }
  );
}

module.exports = fp(editSubmittedApplication);