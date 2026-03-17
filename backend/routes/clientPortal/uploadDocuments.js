const fs = require("fs");
const path = require("path");

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
        // VALIDATE FORM FIELD
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
          "image/png"
        ];

        if (!allowedMime.includes(file.mimetype)) {
          return reply.status(400).send({
            success: false,
            message: "Only PDF, JPG, PNG files are allowed"
          });
        }

        // ============================
        // ENSURE UPLOAD DIRECTORY
        // ============================

        const uploadDir = path.join(__dirname, "../../../uploads");

        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        // ============================
        // GENERATE FILE NAME
        // ============================

        const safeFileName =
          `${Date.now()}-${file.filename.replace(/\s+/g, "_")}`;

        const filePath = path.join(uploadDir, safeFileName);

        // ============================
        // SAVE FILE
        // ============================

        await new Promise((resolve, reject) => {

          const writeStream = fs.createWriteStream(filePath);

          file.file.pipe(writeStream);

          file.file.on("error", reject);
          writeStream.on("finish", resolve);
          writeStream.on("error", reject);

        });

        // ============================
        // SAVE DOCUMENT RECORD
        // ============================

        const upload = await prisma.applicationDocumentUpload.create({
          data: {
            loanApplicationId: tokenRecord.loanApplicationId,
            documentRequirementId,
            uploadedByClientUserId: null,
            fileName: file.filename,
            fileUrl: `/uploads/${safeFileName}`,
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