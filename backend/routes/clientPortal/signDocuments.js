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
          data: requirements.map((item) => {
            const formatted = formatSignDocumentRequirement(item, {
              viewer: "client",
            });
            const isBrokerLoi =
              item.documentType?.code === "BROKER_LOI_TERM_SHEET" ||
              /\/broker\/LOI\//i.test(item.templateFileUrl || "");
            const isStandaloneBrokerLoi =
              isBrokerLoi && !item.requestApplicationLenderId;

            let loiVersionNumber = null;
            if (isBrokerLoi) {
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
};
