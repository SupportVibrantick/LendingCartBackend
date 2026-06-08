const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream/promises");
const crypto = require("crypto");
const clientAuthMiddleware = require("../../middleware/clientAuthMiddleware");
const { loadTemplate } = require("../../utils/loadTemplate");
const sendMail = require("../../services/mail");
const { sendEmailUsingKafka } = require("../../services/kafka/email/producer");
const {
  notifyBroker,
  BROKER_NOTIFICATION_EVENTS,
} = require("../../services/brokerNotifications");

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

        /* ============================
           FETCH BROKER EMAIL
        ============================ */

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

        const brokerUser =
          loan?.brokerOrg?.users?.find((u) => u.email);

        const brokerEmail = brokerUser?.email;

        /* ============================
           SEND EMAIL TO BROKER
        ============================ */

        if (brokerEmail) {
          const html = loadTemplate("clientPortal/documentUpload", {
            clientName: "Client",
            applicationNumber: loan.applicationNumber,
            fileName: file.filename,
            uploadedAt: new Date().toLocaleString(),
            dashboardLink:
              `${process.env.FRONTEND_URL}/broker/loan-pipeline/${loanApplicationId}`,
            currentYear: new Date().getFullYear(),
          });

          const subject =
            `Client Uploaded Document - Application #${loan.applicationNumber}`;

          const text =
            `Client uploaded a document for application ${loan.applicationNumber}`;

          try {
            await sendEmailUsingKafka(
              brokerEmail,
              subject,
              text,
              html
            );

            await sendMail({
              to: brokerEmail,
              subject,
              text,
              html,
            });
          } catch (err) {
            fastify.log.error(err);

            try {
              await sendMail({
                to: brokerEmail,
                subject,
                text,
                html,
              });
            } catch (mailErr) {
              fastify.log.error(mailErr);
            }
          }
        }

        /* ============================
           CREATE NOTIFICATION
        ============================ */

        const notification = await notifyBroker(prisma, fastify.io, {
          brokerOrgId: loan.brokerOrgId,
          eventType: BROKER_NOTIFICATION_EVENTS.CLIENT_UPLOADED_DOCUMENT,
          category: "DOCUMENT",
          subject: "Client Uploaded Document",
          body: `New document uploaded for application ${loan.applicationNumber}`,
          metadata: {
            loanApplicationId,
            applicationId: loanApplicationId,
            applicationNumber: loan.applicationNumber,
          },
        });

        /* ============================
           RESPONSE
        ============================ */

        return reply.send({
          success: true,
          message: "Document uploaded successfully",
          data: upload,
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