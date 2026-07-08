const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream/promises");
const crypto = require("crypto");
const clientAuthMiddleware = require("../../middleware/clientAuthMiddleware");
const { loadTemplate } = require("../../utils/email/loadTemplate");
const { buildDocumentUploadEmailData } = require("../../utils/email/emailTemplateData");
const sendMail = require("../../services/emails/mail");
const {
  notifyBroker,
  BROKER_NOTIFICATION_EVENTS,
} = require("../../services/notifications/brokerNotifications");
const {
  autoForwardDocumentUpload,
} = require("../../services/documents/autoForwardDocumentUpload");
const {
  syncUploadToExistingLenderSubmissions,
} = require("../../services/documents/syncUploadToExistingLenderSubmissions");
const {
  notifyLendersForForwardedDocument,
} = require("../../services/notifications/lenderNotifications");
const {
  getAutoForwardDocumentsToLender,
} = require("../../services/documents/documentAutoForwardSetting");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */

async function uploadDocumentsRoute(fastify) {
  fastify.post(
    "/upload",
    {
      preHandler: clientAuthMiddleware,
      schema: {
        tags: ["Client Portal"],
        summary: "Client uploads document (Broker notified)",
      },
    },

    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        /* ============================
           AUTH (JWT ONLY)
        ============================ */

        if (!req.client || !req.client.clientId) {
          return reply.code(401).send({
            success: false,
            message: "Unauthorized",
          });
        }

        const clientId = req.client.clientId;

        /* ============================
           GET FILE
        ============================ */

        const file = await req.file();

        if (!file) {
          return reply.code(400).send({
            success: false,
            message: "File is required",
          });
        }

        const documentRequirementId =
          file?.fields?.documentRequirementId?.value;

        const loanApplicationId =
          file?.fields?.loanApplicationId?.value;

        if (!documentRequirementId || !loanApplicationId) {
          return reply.code(400).send({
            success: false,
            message: "Missing required fields",
          });
        }

        /* ============================
           VALIDATE REQUIREMENT
        ============================ */

        const requirement =
          await prisma.applicationDocumentRequirement.findFirst({
            where: {
              id: documentRequirementId,
              loanApplicationId,
            },
          });

        if (!requirement) {
          return reply.code(404).send({
            success: false,
            message: "Document requirement not found",
          });
        }

        const loan = await prisma.loanApplication.findUnique({
          where: { id: loanApplicationId },
          include: {
            brokerOrg: {
              include: {
                users: true,
              },
            },
          },
        });

        if (!loan) {
          return reply.code(404).send({
            success: false,
            message: "Loan application not found",
          });
        }

        /* ============================
           FILE TYPE VALIDATION
        ============================ */

        const allowedMime = [
          "application/pdf",
          "image/jpeg",
          "image/png",
          "image/webp",
        ];

        if (!allowedMime.includes(file.mimetype)) {
          return reply.code(400).send({
            success: false,
            message: "Only PDF, JPG, PNG, WEBP allowed",
          });
        }

        /* ============================
           SAFE FILE NAME
        ============================ */

        const randomName = crypto.randomBytes(16).toString("hex");

        const ext =
          path.extname(file.filename) ||
          getExtensionFromMime(file.mimetype);

        const safeFileName = `${randomName}${ext}`;

        /* ============================
           STORAGE
        ============================ */

        const uploadDir = path.join(
          process.cwd(),
          "uploads",
          "loan-documents"
        );

        await fs.promises.mkdir(uploadDir, { recursive: true });

        const filePath = path.join(uploadDir, safeFileName);

        await pipeline(file.file, fs.createWriteStream(filePath));

        const fileUrl = `/uploads/loan-documents/${safeFileName}`;

        /* ============================
           SAVE DOCUMENT
        ============================ */

        const upload = await prisma.applicationDocumentUpload.create({
          data: {
            loanApplicationId,
            documentRequirementId,
            uploadedByClientUserId: req.client.id,
            fileName: file.filename,
            fileUrl,
            fileMimeType: file.mimetype,
          },
        });

        /* ============================
           UPDATE STATUS
        ============================ */

        await prisma.applicationDocumentRequirement.update({
          where: { id: documentRequirementId },
          data: { status: "PARTIAL" },
        });

        let autoForwardResult = null;
        const autoForwardEnabled = await getAutoForwardDocumentsToLender(
          prisma,
          loanApplicationId,
        );

        if (autoForwardEnabled) {
          try {
            autoForwardResult = await autoForwardDocumentUpload(prisma, {
              loanApplicationId,
              documentRequirementId,
              documentUploadId: upload.id,
            });

            if (autoForwardResult?.forwarded) {
              const requirement = await prisma.applicationDocumentRequirement.findUnique({
                where: { id: documentRequirementId },
                select: {
                  documentType: { select: { name: true } },
                },
              });

              await notifyLendersForForwardedDocument(prisma, fastify.io, {
                applicationLenderIds: autoForwardResult.applicationLenderIds || [],
                loanApplicationId,
                applicationNumber: loan.applicationNumber,
                documentTypeName: requirement?.documentType?.name || file.filename,
                source: "Client",
              });
            }
          } catch (forwardErr) {
            fastify.log.error(
              {
                error: forwardErr.message,
                loanApplicationId,
                documentRequirementId,
                documentUploadId: upload.id,
              },
              "Auto-forward client document failed",
            );
          }
        }

        try {
          await syncUploadToExistingLenderSubmissions(prisma, {
            loanApplicationId,
            documentRequirementId,
            documentUploadId: upload.id,
          });
        } catch (syncErr) {
          fastify.log.error(
            {
              error: syncErr.message,
              loanApplicationId,
              documentRequirementId,
              documentUploadId: upload.id,
            },
            "Sync client upload to existing lender submissions failed",
          );
        }

        /* ============================
           FETCH BROKER EMAIL
        ============================ */

        const brokerUser = loan.brokerOrg?.users?.find((u) => u.email);
        const brokerEmail = brokerUser?.email;

        /* ============================
           SEND EMAIL TO BROKER
        ============================ */

        if (brokerEmail && !autoForwardEnabled) {
          const html = loadTemplate(
            "clientPortal/documentUpload",
            buildDocumentUploadEmailData({
              clientName: loan.client?.legalName || "Client",
              applicationNumber: loan.applicationNumber,
              fileName: file.filename,
              uploadedAt: new Date().toLocaleString("en-US", {
                dateStyle: "medium",
                timeStyle: "short",
              }),
              applicationId: loanApplicationId,
            }),
          );

          const subject =
            `Client Uploaded Document - Application #${loan.applicationNumber}`;

          const text =
            `Client uploaded a document for application ${loan.applicationNumber}`;

          try {
            await sendMail({
              prisma,
              to: brokerEmail,
              subject,
              text,
              html,
              idempotencyKey: `client-upload:${upload.id}`,
            });
          } catch (err) {
            fastify.log.error(err, "Failed to enqueue broker upload notification email");
          }
        }

        /* ============================
           CREATE NOTIFICATION
        ============================ */

        const notification = await notifyBroker(prisma, fastify.io, {
          brokerOrgId: loan.brokerOrgId,
          eventType: BROKER_NOTIFICATION_EVENTS.CLIENT_UPLOADED_DOCUMENT,
          category: "DOCUMENT",
          subject: autoForwardEnabled
            ? "Client document auto-forwarded to lender"
            : "Client Uploaded Document",
          body: autoForwardEnabled
            ? `Document uploaded and forwarded for application ${loan.applicationNumber}`
            : `New document uploaded for application ${loan.applicationNumber}`,
          metadata: {
            loanApplicationId,
            applicationId: loanApplicationId,
            applicationNumber: loan.applicationNumber,
            autoForwarded: Boolean(autoForwardResult?.forwarded),
          },
        });

        /* ============================
           RESPONSE
        ============================ */

        return reply.send({
          success: true,
          message: autoForwardEnabled
            ? "Document uploaded and forwarded to lender"
            : "Document uploaded successfully",
          data: {
            ...upload,
            autoForwarded: Boolean(autoForwardResult?.forwarded),
          },
        });

      } catch (error) {
        req.log.error(error);

        return reply.code(500).send({
          success: false,
          message: "Server error during upload",
        });
      }
    }
  );
}

module.exports = uploadDocumentsRoute;

/* ============================
   EXTENSION HELPER
============================ */

function getExtensionFromMime(mime) {
  switch (mime) {
    case "application/pdf":
      return ".pdf";
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    default:
      return "";
  }
}