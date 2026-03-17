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

        // ==========================================
        // GET FILE FROM MULTIPART
        // ==========================================

        const file = await req.file();

        if (!file) {
          return reply.status(400).send({
            success: false,
            message: "File is required"
          });
        }

        const documentRequirementId = file.fields.documentRequirementId.value;

        // ==========================================
        // TOKEN VALIDATION
        // ==========================================

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

        // ==========================================
        // REQUIREMENT VALIDATION
        // ==========================================

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

        // ==========================================
        // SAVE FILE TO DISK
        // ==========================================

        const fs = require("fs");
        const path = require("path");

        const fileName = `${Date.now()}-${file.filename}`;
        const filePath = path.join(__dirname, "../../../uploads", fileName);

        await new Promise((resolve, reject) => {
          const stream = fs.createWriteStream(filePath);
          file.file.pipe(stream);
          stream.on("finish", resolve);
          stream.on("error", reject);
        });

        // ==========================================
        // SAVE DOCUMENT IN DATABASE
        // ==========================================

        const upload = await prisma.applicationDocumentUpload.create({
          data: {
            loanApplicationId: tokenRecord.loanApplicationId,
            documentRequirementId,
            uploadedByClientUserId: null,
            fileName: file.filename,
            fileUrl: `/uploads/${fileName}`,
            fileMimeType: file.mimetype
          }
        });

        // ==========================================
        // UPDATE REQUIREMENT STATUS
        // ==========================================

        const totalRequired =
          await prisma.applicationDocumentUpload.count({
            where: {
              documentRequirementId
            }
          });

        if (totalRequired > 0) {

          await prisma.applicationDocumentRequirement.update({
            where: { id: documentRequirementId },
            data: { status: "PARTIAL" }
          });

        }

        // ==========================================
        // SUCCESS RESPONSE
        // ==========================================

        return reply.send({
          success: true,
          message: "Document uploaded successfully",
          data: upload
        });

      } catch (error) {

        return reply.status(500).send({
          success: false,
          message: "Server error during document upload"
        });

      }
    }
  );
}

module.exports = uploadDocumentsRoute;