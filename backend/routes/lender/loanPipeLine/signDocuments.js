const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { pipeline } = require("stream/promises");
const {
  formatSignDocumentRequirement,
} = require("../../../utils/documents/formatSignDocument");
const {
  notifyBroker,
  BROKER_NOTIFICATION_EVENTS,
} = require("../../../services/notifications/brokerNotifications");

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

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

        const requirements =
          await fastify.prisma.applicationDocumentRequirement.findMany({
            where: {
              loanApplicationId: applicationLender.loanApplicationId,
              requiresClientSignature: true,
              requestApplicationLenderId: applicationLenderId,
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
            orderBy: { createdAt: "desc" },
          });

        return reply.send({
          success: true,
          data: requirements.map((item) =>
            formatSignDocumentRequirement(item, { viewer: "lender" }),
          ),
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
        const uploadDir = path.join(
          process.cwd(),
          "uploads",
          "loan-documents",
          loanApplicationId,
          "sign-templates",
        );

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

          if (!ALLOWED_MIME_TYPES.has(part.mimetype)) {
            await part.toBuffer();
            return reply.code(400).send({
              success: false,
              message: "Only PDF or image files are allowed",
            });
          }

          const ext =
            path.extname(part.filename || "") ||
            (part.mimetype === "application/pdf" ? ".pdf" : "");
          const safeFileName = `${crypto.randomBytes(16).toString("hex")}${ext}`;

          await fs.promises.mkdir(uploadDir, { recursive: true });
          const filePath = path.join(uploadDir, safeFileName);
          await pipeline(part.file, fs.createWriteStream(filePath));

          uploadedFileMeta = {
            filename: part.filename || documentName || "Sign Document",
            mimetype: part.mimetype,
            templateFileUrl: `/uploads/loan-documents/${loanApplicationId}/sign-templates/${safeFileName}`,
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
          },
        });

        return reply.send({
          success: true,
          message: "Sign document request created",
          data: formatSignDocumentRequirement(result, { viewer: "lender" }),
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
            where: {
              id: requirementId,
              loanApplicationId: applicationLender.loanApplicationId,
              requiresClientSignature: true,
              requestApplicationLenderId: applicationLenderId,
              signStatus: { in: ["FORWARDED_TO_LENDER", "LENDER_SEEN"] },
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
};
