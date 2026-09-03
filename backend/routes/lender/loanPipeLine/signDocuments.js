const path = require("path");
const crypto = require("crypto");
const { validateFileMimetype } = require("../../../utils/security/fileValidator");
const {
  formatSignDocumentRequirement,
} = require("../../../utils/documents/formatSignDocument");
const {
  notifyBroker,
  BROKER_NOTIFICATION_EVENTS,
} = require("../../../services/notifications/brokerNotifications");
const {
  ALLOWED_MIME_TYPES,
  writeSignAssetFromStream,
} = require("../../../services/documents/signForm/storage");
const {
  applyLibraryTemplateSchema,
} = require("../../../schemas/documents/signForm.schema");
const {
  applyLibraryTemplate,
} = require("../../../services/documents/signForm/libraryTemplate.service");
const {
  autoPublishAcroFormIfPresent,
} = require("../../../services/documents/signForm/autoPublishAcroForm");
const {
  buildSignDocumentDownload,
} = require("../../../services/documents/signForm/exportFilledForm.service");
const {
  buildLenderSignDocumentWhere,
  buildLenderSignDocumentRequirementWhere,
} = require("../../../utils/documents/lenderSignDocumentAccess");

const SIGN_DOCUMENT_LIST_INCLUDE = {
  documentType: true,
  uploads: {
    where: { isSignedOutput: true },
    orderBy: { uploadedAt: "desc" },
  },
  requestApplicationLender: {
    include: { lender: { select: { name: true } } },
  },
  activeFormVersion: true,
  signFormSubmissions: {
    orderBy: { createdAt: "desc" },
    take: 1,
    include: { values: true },
  },
};

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function lenderSignDocuments(fastify) {
  fastify.get(
    "/:applicationLenderId/sign-documents",
    async (req, reply) => {
      try {
        if (!req.user || req.user.orgType !== "LENDER") {
          return reply.code(403).send({
            success: false,
            message: "Lender access only",
          });
        }

        const lenderOrgId = req.user.organizationId;
        const { applicationLenderId } = req.params;
        const { page = 1, limit = 9, search = "" } = req.query;
        const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
        const pageSize = Math.min(Math.max(parseInt(limit, 10) || 9, 1), 50);
        const searchTerm =
          typeof search === "string" ? search.trim() : "";

        const applicationLender =
          await fastify.prisma.applicationLender.findFirst({
            where: { id: applicationLenderId, lenderOrgId },
            include: {
              lender: { select: { name: true } },
            },
          });

        if (!applicationLender) {
          return reply.code(404).send({
            success: false,
            message: "Application not found",
          });
        }

        const where = buildLenderSignDocumentWhere(
          applicationLender,
          applicationLenderId,
          searchTerm,
        );

        const [
          total,
          requirements,
          awaitingBroker,
          withClient,
          ready,
          received,
        ] = await Promise.all([
          fastify.prisma.applicationDocumentRequirement.count({ where }),
          fastify.prisma.applicationDocumentRequirement.findMany({
            where,
            include: SIGN_DOCUMENT_LIST_INCLUDE,
            orderBy: { createdAt: "desc" },
            skip: (pageNumber - 1) * pageSize,
            take: pageSize,
          }),
          fastify.prisma.applicationDocumentRequirement.count({
            where: { ...where, signStatus: "AWAITING_BROKER" },
          }),
          fastify.prisma.applicationDocumentRequirement.count({
            where: { ...where, signStatus: "SENT_TO_CLIENT" },
          }),
          fastify.prisma.applicationDocumentRequirement.count({
            where: { ...where, signStatus: "CLIENT_SIGNED" },
          }),
          fastify.prisma.applicationDocumentRequirement.count({
            where: {
              ...where,
              signStatus: { in: ["FORWARDED_TO_LENDER", "LENDER_SEEN"] },
            },
          }),
        ]);

        const totalPages = Math.max(Math.ceil(total / pageSize), 1);

        return reply.send({
          success: true,
          data: requirements.map((item) =>
            formatSignDocumentRequirement(item, { viewer: "lender" }),
          ),
          pagination: {
            page: pageNumber,
            limit: pageSize,
            total,
            totalPages,
          },
          summary: {
            awaitingBroker,
            withClient,
            ready,
            received,
          },
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
    "/:applicationLenderId/sign-documents",
    async (req, reply) => {
      try {
        if (!req.user || req.user.orgType !== "LENDER") {
          return reply.code(403).send({
            success: false,
            message: "Lender access only",
          });
        }

        const lenderOrgId = req.user.organizationId;
        const { applicationLenderId } = req.params;

        const applicationLender =
          await fastify.prisma.applicationLender.findFirst({
            where: { id: applicationLenderId, lenderOrgId },
            include: {
              loanApplication: {
                select: {
                  id: true,
                  applicationNumber: true,
                  brokerOrgId: true,
                  clientId: true,
                },
              },
              lender: { select: { name: true } },
            },
          });

        if (!applicationLender) {
          return reply.code(404).send({
            success: false,
            message: "Application not found",
          });
        }

        let documentName = "";
        let uploadedFileMeta = null;

        const loanApplicationId = applicationLender.loanApplicationId;

        for await (const part of req.parts()) {
          if (part.type === "field" && part.fieldname === "documentName") {
            documentName = String(part.value || "").trim();
            continue;
          }

          if (part.type !== "file" || part.fieldname !== "file") {
            if (part.type === "file") {
              await part.toBuffer();
            }
            continue;
          }

          const validation = await validateFileMimetype(part.file, Array.from(ALLOWED_MIME_TYPES));
          if (!validation.isValid) {
            await part.toBuffer();
            return reply.code(400).send({
              success: false,
              message: `Invalid file type. Detected: ${validation.detectedMime || "unknown"}. Only PDF or image files are allowed`,
            });
          }
          const validatedStream = validation.stream;

          const ext =
            path.extname(part.filename || "") ||
            (part.mimetype === "application/pdf" ? ".pdf" : "");
          const safeFileName = `${crypto.randomBytes(16).toString("hex")}${ext}`;
          const stored = await writeSignAssetFromStream({
            relativeParts: ["loan-documents", loanApplicationId, "sign-templates"],
            filename: safeFileName,
            stream: validatedStream,
            mimeType: part.mimetype,
          });

          uploadedFileMeta = {
            filename: part.filename || documentName || "Sign Document",
            mimetype: part.mimetype,
            templateFileUrl: stored.publicUrl,
          };
        }

        if (!documentName) {
          return reply.code(400).send({
            success: false,
            message: "Document name is required",
          });
        }

        if (!uploadedFileMeta) {
          return reply.code(400).send({
            success: false,
            message: "Template file is required",
          });
        }

        const result = await fastify.prisma.$transaction(async (tx) => {
          let documentType = await tx.documentType.findFirst({
            where: {
              name: documentName,
              createdByOrgId: lenderOrgId,
            },
          });

          if (!documentType) {
            documentType = await tx.documentType.create({
              data: {
                name: documentName,
                code: `SIGN_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                isCustom: true,
                createdByOrgId: lenderOrgId,
                isActive: true,
              },
            });
          }

          const requirement = await tx.applicationDocumentRequirement.create({
            data: {
              loanApplicationId,
              documentTypeId: documentType.id,
              source: "LENDER_ADDED",
              isRequired: true,
              status: "PENDING",
              lastRequestedAt: new Date(),
              requiresClientSignature: true,
              templateFileName: uploadedFileMeta.filename,
              templateFileUrl: uploadedFileMeta.templateFileUrl,
              templateMimeType: uploadedFileMeta.mimetype,
              signStatus: "AWAITING_BROKER",
              requestApplicationLenderId: applicationLenderId,
            },
            include: {
              documentType: true,
              uploads: true,
              requestApplicationLender: {
                include: { lender: { select: { name: true } } },
              },
            },
          });

          await tx.lenderDocumentRequest.upsert({
            where: {
              applicationLenderId_documentTypeId: {
                applicationLenderId,
                documentTypeId: documentType.id,
              },
            },
            update: {
              status: "PENDING",
              updatedAt: new Date(),
            },
            create: {
              loanApplicationId,
              applicationLenderId,
              documentTypeId: documentType.id,
              status: "PENDING",
            },
          });

          return requirement;
        });

        const autoPublish = await autoPublishAcroFormIfPresent(fastify.prisma, {
          requirement: result,
          organizationId: lenderOrgId,
          userId: req.user?.userId || req.user?.id || null,
          logger: fastify.log,
        });

        const refreshed = await fastify.prisma.applicationDocumentRequirement.findUnique({
          where: { id: result.id },
          include: {
            documentType: true,
            uploads: {
              where: { isSignedOutput: true },
              orderBy: { uploadedAt: "desc" },
            },
            requestApplicationLender: {
              include: { lender: { select: { name: true } } },
            },
            activeFormVersion: true,
            signFormSubmissions: {
              orderBy: { createdAt: "desc" },
              take: 1,
              include: { values: true },
            },
          },
        });

        await notifyBroker(fastify.prisma, fastify.io, {
          brokerOrgId: applicationLender.loanApplication.brokerOrgId,
          eventType: BROKER_NOTIFICATION_EVENTS.LENDER_DECISION_CONDITIONAL,
          category: "DOCUMENTS",
          subject: "Sign document requested",
          body: `${applicationLender.lender?.name || "Lender"} requested a signable document: ${documentName}`,
          metadata: {
            loanApplicationId,
            requirementId: result.id,
            applicationNumber:
              applicationLender.loanApplication.applicationNumber,
            signMode: autoPublish.signMode,
            autoPublished: autoPublish.published,
          },
        });

        const message = autoPublish.published
          ? `Sign document request created with ${autoPublish.fieldCount} fillable field${autoPublish.fieldCount === 1 ? "" : "s"}`
          : "Sign document request created";

        return reply.send({
          success: true,
          message,
          data: formatSignDocumentRequirement(refreshed || result, {
            viewer: "lender",
          }),
          autoPublish: {
            published: autoPublish.published,
            signMode: autoPublish.signMode,
            fieldCount: autoPublish.fieldCount,
            reason: autoPublish.reason,
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          message: error.message || "Failed to create sign document",
        });
      }
    },
  );

  fastify.post(
    "/:applicationLenderId/sign-documents/from-template",
    async (req, reply) => {
      try {
        if (!req.user || req.user.orgType !== "LENDER") {
          return reply.code(403).send({
            success: false,
            message: "Lender access only",
          });
        }

        const lenderOrgId = req.user.organizationId;
        const { applicationLenderId } = req.params;
        const parsed = applyLibraryTemplateSchema.safeParse(req.body || {});
        if (!parsed.success) {
          return reply.code(400).send({
            success: false,
            message: "Template is required",
            errors: parsed.error.flatten(),
          });
        }

        const applicationLender =
          await fastify.prisma.applicationLender.findFirst({
            where: { id: applicationLenderId, lenderOrgId },
            include: {
              loanApplication: {
                select: {
                  id: true,
                  applicationNumber: true,
                  brokerOrgId: true,
                },
              },
              lender: { select: { name: true } },
            },
          });

        if (!applicationLender) {
          return reply.code(404).send({
            success: false,
            message: "Application not found",
          });
        }

        const template = await fastify.prisma.signFormLibraryTemplate.findFirst({
          where: {
            id: parsed.data.templateId,
            organizationId: lenderOrgId,
          },
        });

        if (!template) {
          return reply.code(404).send({
            success: false,
            message: "Template not found",
          });
        }

        const result = await applyLibraryTemplate(fastify.prisma, {
          template,
          applicationLender,
          organizationId: lenderOrgId,
          userId: req.user.userId || req.user.id,
          documentName: parsed.data.documentName,
          req,
        });

        await notifyBroker(fastify.prisma, fastify.io, {
          brokerOrgId: applicationLender.loanApplication.brokerOrgId,
          eventType: BROKER_NOTIFICATION_EVENTS.LENDER_DECISION_CONDITIONAL,
          category: "DOCUMENTS",
          subject: "Sign document requested",
          body: `${applicationLender.lender?.name || "Lender"} requested a signable document: ${result.signDocumentTitle || template.name}`,
          metadata: {
            loanApplicationId: applicationLender.loanApplicationId,
            requirementId: result.id,
            applicationNumber:
              applicationLender.loanApplication.applicationNumber,
            fromTemplateId: template.id,
          },
        });

        return reply.send({
          success: true,
          message: "Sign document created from template",
          data: formatSignDocumentRequirement(result, { viewer: "lender" }),
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(error.statusCode || 500).send({
          success: false,
          message: error.message || "Failed to apply template",
        });
      }
    },
  );

  fastify.post(
    "/:applicationLenderId/sign-documents/:requirementId/mark-seen",
    async (req, reply) => {
      try {
        if (!req.user || req.user.orgType !== "LENDER") {
          return reply.code(403).send({
            success: false,
            message: "Lender access only",
          });
        }

        const lenderOrgId = req.user.organizationId;
        const { applicationLenderId, requirementId } = req.params;

        const applicationLender =
          await fastify.prisma.applicationLender.findFirst({
            where: { id: applicationLenderId, lenderOrgId },
          });

        if (!applicationLender) {
          return reply.code(404).send({
            success: false,
            message: "Application not found",
          });
        }

        const requirement =
          await fastify.prisma.applicationDocumentRequirement.findFirst({
            where: buildLenderSignDocumentRequirementWhere({
              loanApplicationId: applicationLender.loanApplicationId,
              applicationLenderId,
              requirementId,
              signStatus: { in: ["FORWARDED_TO_LENDER", "LENDER_SEEN"] },
            }),
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

        if (!requirement) {
          return reply.code(404).send({
            success: false,
            message: "Signed document not found",
          });
        }

        if (requirement.signStatus === "LENDER_SEEN") {
          return reply.send({
            success: true,
            message: "Already marked as seen",
            data: formatSignDocumentRequirement(requirement, {
              viewer: "lender",
            }),
          });
        }

        const updated =
          await fastify.prisma.applicationDocumentRequirement.update({
            where: { id: requirement.id },
            data: {
              signStatus: "LENDER_SEEN",
              lenderSeenAt: new Date(),
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

        return reply.send({
          success: true,
          message: "Marked as seen by lender",
          data: formatSignDocumentRequirement(updated, { viewer: "lender" }),
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          message: error.message || "Failed to mark document as seen",
        });
      }
    },
  );

  fastify.get(
    "/:applicationLenderId/sign-documents/:requirementId/download-filled",
    async (req, reply) => {
      try {
        if (!req.user || req.user.orgType !== "LENDER") {
          return reply.code(403).send({
            success: false,
            message: "Lender access only",
          });
        }

        const lenderOrgId = req.user.organizationId;
        const { applicationLenderId, requirementId } = req.params;

        const applicationLender =
          await fastify.prisma.applicationLender.findFirst({
            where: { id: applicationLenderId, lenderOrgId },
          });

        if (!applicationLender) {
          return reply.code(404).send({
            success: false,
            message: "Application not found",
          });
        }

        const requirement =
          await fastify.prisma.applicationDocumentRequirement.findFirst({
            where: buildLenderSignDocumentRequirementWhere({
              loanApplicationId: applicationLender.loanApplicationId,
              applicationLenderId,
              requirementId,
            }),
            select: { id: true, signStatus: true },
          });

        if (!requirement) {
          return reply.code(404).send({
            success: false,
            message: "Sign document not found",
          });
        }

        const file = await buildSignDocumentDownload(
          fastify.prisma,
          requirementId,
        );

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
