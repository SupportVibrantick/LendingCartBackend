const jwt = require("jsonwebtoken");
const path = require("path");
const crypto = require("crypto");
const clientAuthMiddleware = require("../../middleware/clientAuthMiddleware");
const {
  formatSignDocumentRequirement,
} = require("../../utils/documents/formatSignDocument");
const {
  createSignedDocumentFile,
} = require("../../services/documents/signDocumentMerge");
const {
  notifyBroker,
  BROKER_NOTIFICATION_EVENTS,
} = require("../../services/notifications/brokerNotifications");

async function resolveClientFromRequest(req, prisma) {
  if (req.client?.clientId) {
    return { clientId: req.client.clientId };
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.clientId && decoded.role === "CLIENT") {
      return { clientId: decoded.clientId };
    }
  } catch {
    return null;
  }

  return null;
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
        const auth = await resolveClientFromRequest(req, prisma);
        if (!auth) {
          return reply.code(401).send({
            success: false,
            message: "Unauthorized",
          });
        }

        const { applicationId } = req.params;

        const application = await prisma.loanApplication.findFirst({
          where: { id: applicationId, clientId: auth.clientId },
        });

        if (!application) {
          return reply.code(404).send({
            success: false,
            message: "Application not found",
          });
        }

        const requirements = await prisma.applicationDocumentRequirement.findMany({
          where: {
            loanApplicationId: applicationId,
            requiresClientSignature: true,
            signStatus: {
              in: [
                "SENT_TO_CLIENT",
                "CLIENT_SIGNED",
                "FORWARDED_TO_LENDER",
                "LENDER_SEEN",
              ],
            },
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
            formatSignDocumentRequirement(item, { viewer: "client" }),
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

        const requirement = await prisma.applicationDocumentRequirement.findFirst({
          where: {
            id: requirementId,
            loanApplicationId,
            requiresClientSignature: true,
            loanApplication: { clientId: req.client.clientId },
          },
          include: {
            documentType: true,
            loanApplication: {
              select: {
                id: true,
                applicationNumber: true,
                brokerOrgId: true,
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

        const signedFile = await createSignedDocumentFile({
          templateFileUrl: requirement.templateFileUrl,
          templateMimeType: requirement.templateMimeType,
          templateFileName: requirement.templateFileName,
          signature,
          outputDir,
          outputBaseName: `signed-${crypto.randomBytes(8).toString("hex")}`,
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
              clientSignedAt: new Date(),
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

        await notifyBroker(prisma, fastify.io, {
          brokerOrgId: requirement.loanApplication.brokerOrgId,
          eventType: BROKER_NOTIFICATION_EVENTS.CLIENT_UPLOADED_DOCUMENT,
          category: "DOCUMENTS",
          subject: "Client signed a document",
          body: `${requirement.documentType?.name || "Document"} was signed by the client`,
          metadata: {
            loanApplicationId: requirement.loanApplicationId,
            requirementId: requirement.id,
            signedUploadId: result.signedUpload.id,
          },
        });

        return reply.send({
          success: true,
          message: "Document signed successfully",
          data: formatSignDocumentRequirement(result.updatedRequirement, {
            viewer: "client",
          }),
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
};
