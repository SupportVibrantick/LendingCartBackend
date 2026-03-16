const { clientLogs } = require("../../services/logger/contextLogger");

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
        },

        body: {
          type: "object",
          required: ["documentRequirementId"],
          properties: {
            documentRequirementId: { type: "string" }
          }
        }
      }
    },

    async (req, reply) => {

      const prisma = fastify.prisma;

      try {

        const { token } = req.params;
        const { documentRequirementId } = req.body;

        const file = req.file;

        // ==========================================
        // FILE VALIDATION
        // ==========================================

        if (!file) {
          return reply.status(400).send({
            success: false,
            message: "File is required"
          });
        }

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
        // SAVE DOCUMENT
        // ==========================================

        const upload = await prisma.applicationDocumentUpload.create({
          data: {
            loanApplicationId: tokenRecord.loanApplicationId,
            documentRequirementId,
            uploadedByClientUserId: null,
            fileName: file.filename || file.originalname,
            fileUrl: `/uploads/${file.filename}`,
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

        clientLogs.info("Client document uploaded", {
          loanApplicationId: tokenRecord.loanApplicationId,
          requirementId: documentRequirementId
        });

        return reply.send({
          success: true,
          message: "Document uploaded successfully",
          data: upload
        });

      } catch (error) {

        clientLogs.error("Client document upload failed", error);

        return reply.status(500).send({
          success: false,
          message: "Server error during document upload"
        });
      }
    }
  );
}

module.exports = uploadDocumentsRoute;