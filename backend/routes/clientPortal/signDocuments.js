const jwt = require("jsonwebtoken");
const path = require("path");
const crypto = require("crypto");
const clientAuthMiddleware = require("../../middleware/clientAuthMiddleware");
const {
  formatSignDocumentRequirement,
} = require("../../utils/documents/formatSignDocument");
const {
  listClientSignDocuments,
  isBrokerLoiRequirement,
} = require("../../utils/documents/listSignDocuments");
const {
  createSignedDocumentFile,
} = require("../../services/documents/signDocumentMerge");
const {
  getFormForRequirement,
} = require("../../services/documents/signForm/formService");
const {
  annotateFieldsForRole,
  computeProgress,
  getOrCreateDraftSubmission,
  missingRequiredFields,
  saveSubmissionValues,
  finalizeFormIfComplete,
  valuesMapFromSubmission,
  fieldEditableByRole,
} = require("../../services/documents/signForm/submissionService");
const {
  submitSignFormSchema,
  saveSignFormValuesSchema,
} = require("../../schemas/documents/signForm.schema");
const {
  notifyBrokerFormProgress,
} = require("../../services/documents/signForm/signDocumentNotify");
const {
  buildSignDocumentDownload,
} = require("../../services/documents/signForm/exportFilledForm.service");
const {
  notifyBroker,
  BROKER_NOTIFICATION_EVENTS,
} = require("../../services/notifications/brokerNotifications");
const {
  markBrokerLoiVersionClientSigned,
  getCurrentBrokerLoiVersion,
} = require("../../services/loi/loiVersionService");
const {
  resolvePortalClientIds,
} = require("../../utils/auth/clientPortalAuth");
const jwtSecret = require("../../utils/auth/jwtSecret");

async function resolveClientFromRequest(req) {
  if (req.client?.clientId) {
    return {
      clientId: req.client.clientId,
      portalUserId: req.user?.id || req.client?.id || null,
      email: req.user?.email || req.client?.email || null,
    };
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, jwtSecret);
    if (decoded.clientId && decoded.role === "CLIENT") {
      return {
        clientId: decoded.clientId,
        portalUserId: decoded.id || null,
        email: decoded.email || decoded.clientEmail || null,
      };
    }
  } catch {
    return null;
  }

  return null;
}

async function resolveAccessibleClientIds(prisma, auth) {
  const clientIds = await resolvePortalClientIds(prisma, {
    portalUserId: auth.portalUserId,
    clientId: auth.clientId,
    email: auth.email,
  });
  return clientIds.length > 0 ? clientIds : [auth.clientId];
}

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function clientSignDocuments(fastify) {
  fastify.get(
    "/applications/:applicationId/sign-documents",
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        const auth = await resolveClientFromRequest(req);
        if (!auth) {
          return reply.code(401).send({
            success: false,
            message: "Unauthorized",
          });
        }

        const { applicationId } = req.params;
        const scope = req.query.scope || "all";
        const bucket = req.query.bucket || "all";
        const pageNumber = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const pageSize = Math.min(
          Math.max(parseInt(req.query.limit, 10) || 9, 1),
          50,
        );
        const searchTerm = (req.query.search || "").trim();
        const clientIds = await resolveAccessibleClientIds(prisma, auth);

        const application = await prisma.loanApplication.findFirst({
          where: {
            id: applicationId,
            clientId: { in: clientIds },
          },
          select: { id: true, currentBrokerLoiVersionId: true },
        });

        if (!application) {
          return reply.code(404).send({
            success: false,
            message: "Application not found",
          });
        }

        const listResult = await listClientSignDocuments(prisma, {
          loanApplicationId: applicationId,
          scope,
          bucket,
          pageNumber,
          pageSize,
          searchTerm,
          viewer: "client",
        });

        const requirementsById = new Map(
          (
            await prisma.applicationDocumentRequirement.findMany({
              where: {
                id: { in: listResult.data.map((row) => row.requirementId) },
              },
              select: {
                id: true,
                documentType: { select: { code: true } },
                templateFileUrl: true,
                requestApplicationLenderId: true,
                signStatus: true,
              },
            })
          ).map((item) => [item.id, item]),
        );

        const brokerLoiVersions = await prisma.brokerLoiVersion.findMany({
          where: { loanApplicationId: applicationId },
          orderBy: { versionNumber: "asc" },
          select: {
            id: true,
            documentRequirementId: true,
            versionNumber: true,
            status: true,
            signedPdfUrl: true,
            clientSignedAt: true,
          },
        });

        const currentBrokerLoiVersion = application.currentBrokerLoiVersionId
          ? brokerLoiVersions.find(
              (item) => item.id === application.currentBrokerLoiVersionId,
            )
          : brokerLoiVersions[brokerLoiVersions.length - 1] || null;

        const versionByRequirementId = new Map(
          brokerLoiVersions
            .filter((item) => item.documentRequirementId)
            .map((item) => [item.documentRequirementId, item]),
        );

        const previousSignedLoiVersions = brokerLoiVersions.filter(
          (item) =>
            item.id !== currentBrokerLoiVersion?.id &&
            ["CLIENT_SIGNED", "FORWARDED_TO_LENDER", "SUPERSEDED"].includes(
              item.status,
            ) &&
            item.signedPdfUrl,
        );

        return reply.send({
          success: true,
          data: listResult.data.map((formatted) => {
            const item = requirementsById.get(formatted.requirementId);
            const isBrokerLoi = item ? isBrokerLoiRequirement(item) : false;
            const isStandaloneBrokerLoi =
              isBrokerLoi && !item?.requestApplicationLenderId;

            let loiVersionNumber = null;
            if (isBrokerLoi && item) {
              if (item.signStatus === "SENT_TO_CLIENT" && currentBrokerLoiVersion) {
                loiVersionNumber = currentBrokerLoiVersion.versionNumber;
              } else {
                const linkedVersion = versionByRequirementId.get(item.id);
                loiVersionNumber =
                  linkedVersion?.versionNumber ||
                  currentBrokerLoiVersion?.versionNumber ||
                  null;
              }
            }

            return {
              ...formatted,
              loiVersionNumber,
              loiVersionLabel: loiVersionNumber
                ? `Version ${loiVersionNumber}`
                : null,
              isBrokerLoi,
              isStandaloneBrokerLoi,
            };
          }),
          pagination: listResult.pagination,
          summary: listResult.summary,
          previousSignedLoiVersions: previousSignedLoiVersions.map((item) => ({
            versionNumber: item.versionNumber,
            label: `Version ${item.versionNumber}`,
            signedPdfUrl: item.signedPdfUrl,
            clientSignedAt: item.clientSignedAt,
            status: item.status,
          })),
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          message: error.message || "Failed to load sign documents",
        });
      }
    },
  );

  fastify.post(
    "/sign-documents/:requirementId/sign",
    {
      preHandler: clientAuthMiddleware,
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        if (!req.client?.clientId) {
          return reply.code(401).send({
            success: false,
            message: "Unauthorized",
          });
        }

        const { requirementId } = req.params;
        const { signature, loanApplicationId } = req.body || {};

        if (!signature) {
          return reply.code(400).send({
            success: false,
            message: "Signature is required",
          });
        }

        const clientIds = await resolveAccessibleClientIds(prisma, {
          clientId: req.client.clientId,
          portalUserId: req.user?.id || req.client?.id || null,
          email: req.user?.email || req.client?.email || null,
        });

        const requirement = await prisma.applicationDocumentRequirement.findFirst({
          where: {
            id: requirementId,
            loanApplicationId,
            requiresClientSignature: true,
            loanApplication: { clientId: { in: clientIds } },
          },
          include: {
            documentType: true,
            loanApplication: {
              select: {
                id: true,
                applicationNumber: true,
                brokerOrgId: true,
                client: {
                  include: {
                    contacts: {
                      where: { isPrimary: true },
                      take: 1,
                    },
                  },
                },
              },
            },
            requestApplicationLender: {
              include: { lender: { select: { name: true } } },
            },
          },
        });

        if (!requirement) {
          return reply.code(404).send({
            success: false,
            message: "Sign document not found",
          });
        }

        if (requirement.signStatus !== "SENT_TO_CLIENT") {
          return reply.code(400).send({
            success: false,
            message: "This document is not ready for signing",
          });
        }

        const outputDir = path.join(
          process.cwd(),
          "uploads",
          "loan-documents",
          requirement.loanApplicationId,
          requirement.id,
        );

        const signedAt = new Date();
        const primaryContact = requirement.loanApplication.client?.contacts?.[0];
        const signerName =
          [primaryContact?.firstName, primaryContact?.lastName]
            .filter(Boolean)
            .join(" ")
            .trim() ||
          requirement.loanApplication.client?.legalName ||
          "Client";

        const signedFile = await createSignedDocumentFile({
          templateFileUrl: requirement.templateFileUrl,
          templateMimeType: requirement.templateMimeType,
          templateFileName: requirement.templateFileName,
          signature,
          outputDir,
          outputBaseName: `signed-${crypto.randomBytes(8).toString("hex")}`,
          signerName,
          signedAt,
        });

        const result = await prisma.$transaction(async (tx) => {
          const signedUpload = await tx.applicationDocumentUpload.create({
            data: {
              loanApplicationId: requirement.loanApplicationId,
              documentRequirementId: requirement.id,
              uploadedByClientUserId: req.user?.id || null,
              fileName: signedFile.fileName,
              fileUrl: signedFile.fileUrl,
              fileMimeType: signedFile.fileMimeType,
              isSignedOutput: true,
              clientSignatureData: signature,
              isSubmittedToLender: false,
            },
          });

          const updatedRequirement = await tx.applicationDocumentRequirement.update({
            where: { id: requirement.id },
            data: {
              signStatus: "CLIENT_SIGNED",
              clientSignedAt: signedAt,
              status: "COMPLETE",
            },
            include: {
              documentType: true,
              uploads: {
                where: { isSignedOutput: true },
                orderBy: { uploadedAt: "desc" },
              },
              requestApplicationLender: {
                include: { lender: { select: { name: true } } },
              },
            },
          });

          return { signedUpload, updatedRequirement };
        });

        const isBrokerLoi =
          requirement.documentType?.code === "BROKER_LOI_TERM_SHEET" ||
          /\/broker\/LOI\//i.test(requirement.templateFileUrl || "");
        if (isBrokerLoi) {
          let version = await prisma.brokerLoiVersion.findFirst({
            where: { documentRequirementId: requirement.id },
          });

          if (!version) {
            version = await getCurrentBrokerLoiVersion(
              prisma,
              requirement.loanApplicationId,
            );
          }

          if (version?.id) {
            await markBrokerLoiVersionClientSigned(
              prisma,
              version.id,
              result.signedUpload.fileUrl,
            );

            if (!version.documentRequirementId) {
              await prisma.brokerLoiVersion.update({
                where: { id: version.id },
                data: { documentRequirementId: requirement.id },
              });
            }
          }
        }

        await notifyBroker(prisma, fastify.io, {
          brokerOrgId: requirement.loanApplication.brokerOrgId,
          eventType: BROKER_NOTIFICATION_EVENTS.CLIENT_UPLOADED_DOCUMENT,
          category: "DOCUMENTS",
          subject: isBrokerLoi
            ? "Client signed broker term sheet"
            : "Client signed a document",
          body: isBrokerLoi
            ? `${requirement.signDocumentTitle || "Broker LOI / Term Sheet"} was signed by the client`
            : `${requirement.signDocumentTitle || requirement.documentType?.name || "Document"} was signed by the client`,
          metadata: {
            loanApplicationId: requirement.loanApplicationId,
            requirementId: requirement.id,
            signedUploadId: result.signedUpload.id,
            signedFileUrl: result.signedUpload.fileUrl,
            brokerLoi: isBrokerLoi,
            standaloneBrokerLoi: isBrokerLoi && !requirement.requestApplicationLenderId,
          },
        });

        return reply.send({
          success: true,
          message: isBrokerLoi
            ? "Broker term sheet signed successfully"
            : "Document signed successfully",
          data: {
            ...formatSignDocumentRequirement(result.updatedRequirement, {
              viewer: "client",
            }),
            isBrokerLoi,
            isStandaloneBrokerLoi:
              isBrokerLoi && !requirement.requestApplicationLenderId,
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          message: error.message || "Failed to sign document",
        });
      }
    },
  );

  fastify.get(
    "/sign-documents/:requirementId/form",
    {
      preHandler: clientAuthMiddleware,
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        if (!req.client?.clientId) {
          return reply.code(401).send({
            success: false,
            message: "Unauthorized",
          });
        }

        const { requirementId } = req.params;
        const loanApplicationId = req.query?.loanApplicationId;
        if (!loanApplicationId) {
          return reply.code(400).send({
            success: false,
            message: "loanApplicationId is required",
          });
        }

        const clientIds = await resolveAccessibleClientIds(prisma, {
          clientId: req.client.clientId,
          portalUserId: req.user?.id || req.client?.id || null,
          email: req.user?.email || req.client?.email || null,
        });

        const requirement = await prisma.applicationDocumentRequirement.findFirst({
          where: {
            id: requirementId,
            loanApplicationId,
            requiresClientSignature: true,
            loanApplication: { clientId: { in: clientIds } },
            signStatus: {
              in: ["SENT_TO_CLIENT", "CLIENT_SIGNED", "FORWARDED_TO_LENDER", "LENDER_SEEN"],
            },
          },
        });

        if (!requirement) {
          return reply.code(404).send({
            success: false,
            message: "Sign document not found",
          });
        }

        if (requirement.signMode !== "DYNAMIC_FORM") {
          return reply.code(400).send({
            success: false,
            message: "This document is not a fillable form",
          });
        }

        const form = await getFormForRequirement(prisma, requirementId, {
          preferPublished: true,
        });

        if (!form?.versionId || form.versionStatus !== "PUBLISHED") {
          return reply.code(400).send({
            success: false,
            message: "Published form not found",
          });
        }

        const draft = await getOrCreateDraftSubmission(prisma, {
          requirementId,
          formVersionId: form.versionId,
        });
        const values = valuesMapFromSubmission(draft);
        const progress = computeProgress(form.schema, values);
        const fields = annotateFieldsForRole(
          form.schema?.fields || [],
          "client",
          values,
          form.schema,
        );

        return reply.send({
          success: true,
          data: {
            ...form,
            schema: {
              ...form.schema,
              fields,
            },
            progress,
            readOnly: requirement.signStatus !== "SENT_TO_CLIENT",
            submission: {
              id: draft.id,
              status: draft.status,
              values,
            },
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          message: error.message || "Failed to load form",
        });
      }
    },
  );

  fastify.put(
    "/sign-documents/:requirementId/form/values",
    {
      preHandler: clientAuthMiddleware,
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        if (!req.client?.clientId) {
          return reply.code(401).send({
            success: false,
            message: "Unauthorized",
          });
        }

        const { requirementId } = req.params;
        const parsed = saveSignFormValuesSchema.safeParse(req.body || {});
        if (!parsed.success) {
          return reply.code(400).send({
            success: false,
            message: "Invalid values payload",
            errors: parsed.error.flatten(),
          });
        }

        const loanApplicationId = req.body?.loanApplicationId;
        if (!loanApplicationId) {
          return reply.code(400).send({
            success: false,
            message: "loanApplicationId is required",
          });
        }

        const clientIds = await resolveAccessibleClientIds(prisma, {
          clientId: req.client.clientId,
          portalUserId: req.user?.id || req.client?.id || null,
          email: req.user?.email || req.client?.email || null,
        });

        const requirement = await prisma.applicationDocumentRequirement.findFirst({
          where: {
            id: requirementId,
            loanApplicationId,
            requiresClientSignature: true,
            loanApplication: { clientId: { in: clientIds } },
          },
          include: {
            documentType: true,
            activeFormVersion: true,
            loanApplication: {
              select: {
                id: true,
                applicationNumber: true,
                brokerOrgId: true,
              },
            },
          },
        });

        if (!requirement) {
          return reply.code(404).send({
            success: false,
            message: "Sign document not found",
          });
        }

        if (requirement.signStatus !== "SENT_TO_CLIENT") {
          return reply.code(400).send({
            success: false,
            message: "This document is not ready for form editing",
          });
        }

        if (
          requirement.signMode !== "DYNAMIC_FORM" ||
          !requirement.activeFormVersion
        ) {
          return reply.code(400).send({
            success: false,
            message: "Published fillable form not found",
          });
        }

        const schema = requirement.activeFormVersion.schemaJson;
        const editableFields = (schema?.fields || []).filter((field) =>
          fieldEditableByRole(field, "client"),
        );

        const draft = await getOrCreateDraftSubmission(prisma, {
          requirementId: requirement.id,
          formVersionId: requirement.activeFormVersionId,
        });

        const updatedSubmission = await saveSubmissionValues(prisma, {
          submissionId: draft.id,
          values: parsed.data.values,
          role: "client",
          editableFields,
        });

        const values = valuesMapFromSubmission(updatedSubmission);
        const progress = computeProgress(schema, values);

        return reply.send({
          success: true,
          message: "Draft saved",
          data: {
            progress,
            finalized: false,
            submission: {
              id: updatedSubmission.id,
              status: updatedSubmission.status,
              values,
            },
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          message: error.message || "Failed to save draft",
        });
      }
    },
  );

  fastify.post(
    "/sign-documents/:requirementId/submit-form",
    {
      preHandler: clientAuthMiddleware,
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        if (!req.client?.clientId) {
          return reply.code(401).send({
            success: false,
            message: "Unauthorized",
          });
        }

        const { requirementId } = req.params;
        const parsed = submitSignFormSchema.safeParse(req.body || {});
        if (!parsed.success) {
          return reply.code(400).send({
            success: false,
            message: "Invalid submission payload",
            errors: parsed.error.flatten(),
          });
        }

        const { loanApplicationId, values } = parsed.data;
        if (!loanApplicationId) {
          return reply.code(400).send({
            success: false,
            message: "loanApplicationId is required",
          });
        }

        const clientIds = await resolveAccessibleClientIds(prisma, {
          clientId: req.client.clientId,
          portalUserId: req.user?.id || req.client?.id || null,
          email: req.user?.email || req.client?.email || null,
        });

        const requirement = await prisma.applicationDocumentRequirement.findFirst({
          where: {
            id: requirementId,
            loanApplicationId,
            requiresClientSignature: true,
            loanApplication: { clientId: { in: clientIds } },
          },
          include: {
            documentType: true,
            activeFormVersion: true,
            loanApplication: {
              select: {
                id: true,
                applicationNumber: true,
                brokerOrgId: true,
                client: { select: { legalName: true } },
              },
            },
          },
        });

        if (!requirement) {
          return reply.code(404).send({
            success: false,
            message: "Sign document not found",
          });
        }

        if (requirement.signStatus !== "SENT_TO_CLIENT") {
          return reply.code(400).send({
            success: false,
            message: "This document is not ready for form submission",
          });
        }

        if (
          requirement.signMode !== "DYNAMIC_FORM" ||
          !requirement.activeFormVersion
        ) {
          return reply.code(400).send({
            success: false,
            message: "Published fillable form not found",
          });
        }

        const schema = requirement.activeFormVersion.schemaJson;
        const editableFields = (schema?.fields || []).filter((field) =>
          fieldEditableByRole(field, "client"),
        );

        const draft = await getOrCreateDraftSubmission(prisma, {
          requirementId: requirement.id,
          formVersionId: requirement.activeFormVersionId,
        });

        const updatedSubmission = await saveSubmissionValues(prisma, {
          submissionId: draft.id,
          values,
          role: "client",
          editableFields,
        });

        const mergedValues = valuesMapFromSubmission(updatedSubmission);
        const missingClient = missingRequiredFields(
          schema,
          mergedValues,
          "client",
        );
        if (missingClient.length) {
          return reply.code(400).send({
            success: false,
            message: `${missingClient[0].label || missingClient[0].key} is required`,
          });
        }

        const progress = computeProgress(schema, mergedValues);

        const finalizeResult = await finalizeFormIfComplete(prisma, {
          requirement,
          schema,
          submission: updatedSubmission,
          clientUserId: req.user?.id || null,
        });

        await notifyBrokerFormProgress({
          prisma,
          io: fastify.io,
          requirement,
          brokerOrgId: requirement.loanApplication.brokerOrgId,
          application: {
            id: requirement.loanApplication.id,
            applicationNumber: requirement.loanApplication.applicationNumber,
            client: requirement.loanApplication.client,
          },
          finalized: Boolean(finalizeResult.finalized),
          awaitingBrokerFields: !finalizeResult.finalized,
          logger: fastify.log,
        });

        if (!finalizeResult.finalized) {
          return reply.send({
            success: true,
            message:
              "Your fields were saved. Waiting for broker to complete remaining fields.",
            data: {
              ...formatSignDocumentRequirement(requirement, {
                viewer: "client",
              }),
              progress,
              finalized: false,
              awaitingBrokerFields: true,
            },
          });
        }

        return reply.send({
          success: true,
          message: "Form submitted successfully",
          data: {
            ...formatSignDocumentRequirement(finalizeResult.requirement, {
              viewer: "client",
            }),
            progress: finalizeResult.progress,
            finalized: true,
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          message: error.message || "Failed to submit form",
        });
      }
    },
  );

  fastify.get(
    "/sign-documents/:requirementId/download-filled",
    {
      preHandler: clientAuthMiddleware,
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        if (!req.client?.clientId) {
          return reply.code(401).send({
            success: false,
            message: "Unauthorized",
          });
        }

        const { requirementId } = req.params;
        const loanApplicationId =
          req.query?.loanApplicationId || req.query?.applicationId;

        if (!loanApplicationId) {
          return reply.code(400).send({
            success: false,
            message: "loanApplicationId is required",
          });
        }

        const clientIds = await resolveAccessibleClientIds(prisma, {
          clientId: req.client.clientId,
          portalUserId: req.user?.id || req.client?.id || null,
          email: req.user?.email || req.client?.email || null,
        });

        const requirement = await prisma.applicationDocumentRequirement.findFirst({
          where: {
            id: requirementId,
            loanApplicationId,
            requiresClientSignature: true,
            loanApplication: { clientId: { in: clientIds } },
          },
          select: { id: true },
        });

        if (!requirement) {
          return reply.code(404).send({
            success: false,
            message: "Sign document not found",
          });
        }

        const file = await buildSignDocumentDownload(prisma, requirementId);

        return reply
          .header("Content-Type", file.mimeType)
          .header(
            "Content-Disposition",
            `attachment; filename="${file.fileName.replace(/"/g, "")}"`,
          )
          .send(file.buffer);
      } catch (error) {
        fastify.log.error(error);
        return reply.code(error.statusCode || 500).send({
          success: false,
          message: error.message || "Failed to download filled form",
        });
      }
    },
  );
};
