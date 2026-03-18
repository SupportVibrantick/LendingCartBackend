const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream/promises");
const crypto = require("crypto");

const { loadTemplate } = require("../../utils/loadTemplate");
const sendMail = require("../../services/mail");
const { sendEmailUsingKafka } = require("../../services/kafka/email/producer");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */

async function uploadDocumentsRoute(fastify) {

  fastify.post(
    "/:token/upload",
    {
      schema: {
        tags: ["Client Portal"],
        summary: "Upload document using secure token",

        params: {
          type: "object",
          required: ["token"],
          properties: {
            token: { type: "string" }
          }
        }
      }
    },

    async (req, reply) => {

      const prisma = fastify.prisma;

      try {

        const { token } = req.params;

        // ============================
        // GET FILE
        // ============================

        const file = await req.file();

        if (!file) {
          return reply.status(400).send({
            success: false,
            message: "File is required"
          });
        }

        // ============================
        // VALIDATE FIELD
        // ============================

        const documentRequirementId =
          file?.fields?.documentRequirementId?.value;

        if (!documentRequirementId) {
          return reply.status(400).send({
            success: false,
            message: "documentRequirementId is required"
          });
        }

        // ============================
        // TOKEN VALIDATION
        // ============================

        const tokenRecord = await prisma.clientUploadToken.findUnique({
          where: { token }
        });

        if (!tokenRecord) {
          return reply.status(404).send({
            success: false,
            message: "Invalid upload token"
          });
        }

        if (tokenRecord.expiresAt < new Date()) {
          return reply.status(400).send({
            success: false,
            message: "Upload link expired"
          });
        }

        // ============================
        // REQUIREMENT VALIDATION
        // ============================

        const requirement =
          await prisma.applicationDocumentRequirement.findFirst({
            where: {
              id: documentRequirementId,
              loanApplicationId: tokenRecord.loanApplicationId
            }
          });

        if (!requirement) {
          return reply.status(404).send({
            success: false,
            message: "Document requirement not found"
          });
        }

        // ============================
        // FILE TYPE VALIDATION
        // ============================

        const allowedMime = [
          "application/pdf",
          "image/jpeg",
          "image/png",
          "image/webp"
        ];

        if (!allowedMime.includes(file.mimetype)) {
          return reply.status(400).send({
            success: false,
            message: "Only PDF, JPG, PNG, WEBP files allowed"
          });
        }

        // ============================
        // CREATE SAFE FILE NAME
        // ============================

        const randomName = crypto.randomBytes(16).toString("hex");

        const originalExt = path.extname(file.filename || "");

        const safeExt =
          originalExt || getExtensionFromMime(file.mimetype);

        const safeFileName = `${randomName}${safeExt}`;

        // ============================
        // SAME FOLDER AS BROKER API
        // ============================

        const uploadDir = path.join(
          process.cwd(),
          "uploads",
          "loan-documents"
        );

        await fs.promises.mkdir(uploadDir, { recursive: true });

        const filePath = path.join(uploadDir, safeFileName);

        // ============================
        // SAVE FILE (STREAM SAFE)
        // ============================

        const writeStream = fs.createWriteStream(filePath);

        await pipeline(file.file, writeStream);

        const fileUrl = `/uploads/loan-documents/${safeFileName}`;

        // ============================
        // SAVE DOCUMENT RECORD
        // ============================

        const upload = await prisma.applicationDocumentUpload.create({
          data: {
            loanApplicationId: tokenRecord.loanApplicationId,
            documentRequirementId,
            uploadedByClientUserId: null,
            fileName: file.filename,
            fileUrl,
            fileMimeType: file.mimetype
          }
        });

        // ============================
        // UPDATE REQUIREMENT STATUS
        // ============================

        await prisma.applicationDocumentRequirement.update({
          where: { id: documentRequirementId },
          data: { status: "PARTIAL" }
        });

        // ============================
        // FETCH LENDER EMAIL
        // ============================

        const lenderRecord = await prisma.applicationLender.findFirst({
          where: {
            loanApplicationId: tokenRecord.loanApplicationId,
            status: "IN_REVIEW"
          },
          include: {
            lenderOrganization: true
          }
        });

        const lenderEmail =
          lenderRecord?.lenderOrganization?.email;

        // ============================
        // SEND EMAIL
        // ============================

        if (lenderEmail) {

  const html = loadTemplate("lenderPortal/documentUpload", {
    clientName: "Client",
    applicationNumber: tokenRecord.loanApplicationId,
    fileName: file.filename,
    uploadedAt: new Date().toLocaleString(),
    dashboardLink: `${process.env.FRONTEND_URL}/lender/applications/${tokenRecord.loanApplicationId}`,
    currentYear: new Date().getFullYear()
  });

  const subject =
    `Client Uploaded Document for Application #${tokenRecord.loanApplicationId}`;

  const text =
    `A client has uploaded a document for application ${tokenRecord.loanApplicationId}`;

  // Run email async without breaking upload
  (async () => {
  try {

    // send to kafka
    await sendEmailUsingKafka(
      lenderEmail,
      subject,
      text,
      html
    );

    // ALSO send directly to ensure delivery
    await sendMail({
      to: lenderEmail,
      subject,
      text,
      html
    });

  } catch (err) {

    fastify.log.error("Kafka email failed, sending direct mail", err);

    try {
      await sendMail({
        to: lenderEmail,
        subject,
        text,
        html
      });
    } catch (mailErr) {
      fastify.log.error("Email failed:", mailErr);
    }

  }
})();
}

        // ============================
        // RESPONSE
        // ============================

        return reply.send({
          success: true,
          message: "Document uploaded successfully",
          data: upload
        });

      } catch (error) {

        req.log.error(error);

        return reply.status(500).send({
          success: false,
          message: "Server error during document upload"
        });

      }
    }
  );
}

module.exports = uploadDocumentsRoute;


// ============================
// EXTENSION HELPER
// ============================

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