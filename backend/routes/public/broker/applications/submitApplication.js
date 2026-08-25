const fp = require("fastify-plugin");
const crypto = require("crypto");
const {
  buildSubmissionFieldsPayload,
  loadProductFieldIdMap,
} = require("../../../../services/applications/staticSubmissionFields");
const {
  notifyBroker,
  BROKER_NOTIFICATION_EVENTS,
} = require("../../../../services/notifications/brokerNotifications");
const {
  createClientPortalToken,
  sendClientPortalAccessEmail,
} = require("../../../../services/emails/clientPortalAccessEmail");
const {
  resolveBorrowerNameParts,
  resolveClientDisplayName,
  resolveBorrowerEmail,
} = require("../../../../utils/applications/resolveBorrowerIdentity");
const {
  resolveSubmitLoanProduct,
} = require("../../../../utils/applications/resolveSubmitLoanProduct");
const {
  SOURCE_PORTALS,
  resolvePublicApplicationLinkByToken,
  touchPublicApplicationLink,
  buildLoanApplicationProvenanceFromLink,
} = require("../../../../services/applications/publicApplicationLink");
const {
  findOrCreateBorrowerClient,
} = require("../../../../services/clientPortal/findOrCreateBorrowerClient");

async function submitApplication(fastify) {
  fastify.post(
    "/submit",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 minute",
          errorResponseBuilder: () => ({
            statusCode: 429,
            error: "Too Many Requests",
            success: false,
            message: "Too many application submissions. Please slow down.",
          }),
        },
      },
    },
    async (req, reply) => {
    const {
      applicationId: brokerApplicationId,
      applicationProductId,
      loanProductCode,
      brokerOrgId: bodyBrokerOrgId,
      ref: bodyRef,
      fields,
    } = req.body || {};

    if (!Array.isArray(fields)) {
      return reply.code(400).send({
        success: false,
        message: "Invalid payload",
      });
    }

    let resolvedLoanProductCode;
    let resolvedApplicationProductId = null;
    let brokerOrgId;
    let publicLink = null;
    let provenance = buildLoanApplicationProvenanceFromLink(null);

    const refToken = String(bodyRef || "").trim();

    if (refToken) {
      const resolved = await resolvePublicApplicationLinkByToken(
        fastify.prisma,
        refToken,
      );

      if (!resolved.ok) {
        return reply.code(resolved.status).send({
          success: false,
          code: resolved.code,
          message: resolved.message,
        });
      }

      // Prefer token ownership; never trust body brokerOrgId when ref is present.
      brokerOrgId = resolved.brokerOrganizationId;
      publicLink = resolved.link;
      provenance = buildLoanApplicationProvenanceFromLink(resolved.link);

      if (!loanProductCode && !(brokerApplicationId && applicationProductId)) {
        return reply.code(400).send({
          success: false,
          message:
            "Provide loanProductCode with ref, or applicationId + applicationProductId",
        });
      }

      if (loanProductCode) {
        const resolvedProduct = await resolveSubmitLoanProduct(fastify.prisma, {
          loanProductCode,
        });

        if (resolvedProduct.error) {
          return reply.code(resolvedProduct.error.status).send({
            success: false,
            message: resolvedProduct.error.message,
          });
        }

        resolvedLoanProductCode = resolvedProduct.loanProductCode;
        resolvedApplicationProductId = null;
      } else {
        const brokerProduct =
          await fastify.prisma.brokerApplicationProduct.findFirst({
            where: {
              id: applicationProductId,
              isActive: true,
              brokerApplication: {
                id: brokerApplicationId,
                isActive: true,
                brokerOrgId,
              },
            },
            select: {
              id: true,
              loanProductCode: true,
            },
          });

        if (!brokerProduct) {
          return reply.code(404).send({
            success: false,
            message: "Invalid application product",
          });
        }

        resolvedLoanProductCode = brokerProduct.loanProductCode;
        resolvedApplicationProductId = brokerProduct.id;
      }
    } else if (loanProductCode && bodyBrokerOrgId) {
      const resolvedProduct = await resolveSubmitLoanProduct(fastify.prisma, {
        loanProductCode,
      });

      if (resolvedProduct.error) {
        return reply.code(resolvedProduct.error.status).send({
          success: false,
          message: resolvedProduct.error.message,
        });
      }

      const org = await fastify.prisma.organization.findFirst({
        where: {
          id: bodyBrokerOrgId,
          type: "BROKER",
        },
        select: { id: true },
      });

      if (!org) {
        return reply.code(404).send({
          success: false,
          message: "Invalid broker organization",
        });
      }

      resolvedLoanProductCode = resolvedProduct.loanProductCode;
      resolvedApplicationProductId = null;
      brokerOrgId = org.id;
      provenance = {
        publicApplicationLinkId: null,
        publicSourcePortal: SOURCE_PORTALS.LEGACY,
        publicCreatedByUserId: null,
        brokerUserId: null,
        assignCoBrokerId: null,
      };
    } else if (brokerApplicationId && applicationProductId) {
      // Legacy Application Builder path
      const brokerProduct =
        await fastify.prisma.brokerApplicationProduct.findFirst({
          where: {
            id: applicationProductId,
            isActive: true,
            brokerApplication: {
              id: brokerApplicationId,
              isActive: true,
            },
          },
          select: {
            id: true,
            loanProductCode: true,
            brokerApplication: {
              select: { brokerOrgId: true },
            },
          },
        });

      if (!brokerProduct) {
        return reply.code(404).send({
          success: false,
          message: "Invalid application product",
        });
      }

      resolvedLoanProductCode = brokerProduct.loanProductCode;
      resolvedApplicationProductId = brokerProduct.id;
      brokerOrgId = brokerProduct.brokerApplication.brokerOrgId;
      provenance = {
        publicApplicationLinkId: null,
        publicSourcePortal: SOURCE_PORTALS.LEGACY,
        publicCreatedByUserId: null,
        brokerUserId: null,
        assignCoBrokerId: null,
      };
    } else {
      return reply.code(400).send({
        success: false,
        message:
          "Provide ref + loanProductCode, loanProductCode + brokerOrgId, or applicationId + applicationProductId",
      });
    }

    let result;
    try {
      result = await fastify.prisma.$transaction(async (tx) => {
        const borrowerEmail = resolveBorrowerEmail(fields);
        const { firstName, lastName, displayName } =
          resolveBorrowerNameParts(fields);

        if (!borrowerEmail) {
          throw new Error("Email is required");
        }

        const {
          client,
          email: normalizedEmail,
          warnings: clientWarnings,
        } = await findOrCreateBorrowerClient(tx, {
          brokerOrgId,
          email: borrowerEmail,
          firstName,
          lastName,
          displayName,
          logger: fastify.log,
        });

        const loanApplication = await tx.loanApplication.create({
          data: {
            id: crypto.randomUUID(),
            applicationNumber: `APP-${Date.now()}`,
            brokerOrgId,
            clientId: client.id,
            loanProductCode: resolvedLoanProductCode,
            status: "CLIENT_PENDING",
            ...(provenance.brokerUserId
              ? { brokerUserId: provenance.brokerUserId }
              : {}),
            publicApplicationLinkId: provenance.publicApplicationLinkId,
            publicSourcePortal: provenance.publicSourcePortal,
            publicCreatedByUserId: provenance.publicCreatedByUserId,
          },
        });

        const submission = await tx.applicationSubmission.create({
          data: {
            applicationId: loanApplication.id,
            ...(resolvedApplicationProductId
              ? { applicationProductId: resolvedApplicationProductId }
              : {}),
            status: "CLIENT_PENDING",
          },
        });

        const fieldIdByKey = await loadProductFieldIdMap(
          tx,
          resolvedApplicationProductId,
        );

        const normalizedFields = buildSubmissionFieldsPayload(
          fields,
          fieldIdByKey,
        );

        const submissionFields = normalizedFields.map((f) => ({
          submissionId: submission.id,
          ...f,
        }));

        if (submissionFields.length > 0) {
          await tx.applicationSubmissionField.createMany({
            data: submissionFields,
          });
        }

        if (provenance.assignCoBrokerId) {
          await tx.subBrokerApplication.create({
            data: {
              loanApplicationId: loanApplication.id,
              subBrokerId: provenance.assignCoBrokerId,
              assignedById: provenance.assignCoBrokerId,
            },
          });
        }

        if (publicLink?.id) {
          await touchPublicApplicationLink(tx, publicLink.id);
        }

        const portalToken = await createClientPortalToken(tx, {
          loanApplicationId: loanApplication.id,
          clientId: client.id,
        });

        return {
          submission,
          loanApplication,
          client,
          brokerOrgId,
          borrowerEmail: normalizedEmail,
          portalToken,
          sourcePortal: provenance.publicSourcePortal,
          warnings: clientWarnings,
          clientDisplayName: resolveClientDisplayName({
            client,
            contacts: client.contacts,
            fields,
          }),
        };
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(400).send({
        success: false,
        message: error.message || "Failed to submit application",
      });
    }

    try {
      const brokerOrg = await fastify.prisma.organization.findUnique({
        where: { id: result.brokerOrgId },
        select: { name: true },
      });

      await sendClientPortalAccessEmail({
        prisma: fastify.prisma,
        to: result.borrowerEmail,
        clientName: result.clientDisplayName,
        applicationNumber: result.loanApplication.applicationNumber,
        brokerName: brokerOrg?.name,
        brokerOrgId: result.brokerOrgId,
        portalToken: result.portalToken,
        idempotencyKey: `public-submit-portal:${result.loanApplication.id}`,
      });

      fastify.log.info(
        {
          borrowerEmail: result.borrowerEmail,
          applicationId: result.loanApplication.id,
        },
        "Client portal access email enqueued after public application submit",
      );
    } catch (mailErr) {
      fastify.log.error(
        {
          error: mailErr.message,
          applicationId: result.loanApplication.id,
          borrowerEmail: result.borrowerEmail,
        },
        "Failed to send client portal email after public application submit",
      );
    }

    await notifyBroker(fastify.prisma, fastify.io, {
      brokerOrgId: result.brokerOrgId,
      eventType: BROKER_NOTIFICATION_EVENTS.APPLICATION_SUBMITTED,
      category: "APPLICATION",
      subject: "New Application Submitted",
      body: `New application ${result.loanApplication.applicationNumber} submitted via public form`,
      metadata: {
        applicationId: result.loanApplication.id,
        applicationNumber: result.loanApplication.applicationNumber,
        clientName: result.clientDisplayName,
        source: "PUBLIC_FORM",
        sourcePortal: result.sourcePortal,
      },
    });

    return reply.code(201).send({
      success: true,
      message: "Application submitted successfully",
      data: {
        submissionId: result.submission.id,
        loanApplicationId: result.loanApplication.id,
        sourcePortal: result.sourcePortal,
        ...(result.warnings?.length ? { warnings: result.warnings } : {}),
      },
    });
  });
}

module.exports = fp(submitApplication);
