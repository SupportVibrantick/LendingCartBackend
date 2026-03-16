const { clientLogs } = require("../../services/logger/contextLogger");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function verifyTokenRoute(fastify) {

  fastify.get(
    "/verify/:token",
    {
      schema: {
        tags: ["Client Portal"],
        summary: "Verify document upload token",

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
        // FIND TOKEN
        // ==========================================

        const tokenRecord = await prisma.clientUploadToken.findUnique({
          where: { token },
          include: {
            loanApplication: {
              include: {
                client: true
              }
            }
          }
        });

        if (!tokenRecord) {
          return reply.status(404).send({
            success: false,
            message: "Invalid upload link"
          });
        }

        // ==========================================
        // EXPIRY CHECK
        // ==========================================

        if (tokenRecord.expiresAt < new Date()) {
          return reply.status(400).send({
            success: false,
            message: "Upload link expired"
          });
        }

        const loanApplicationId = tokenRecord.loanApplicationId;

        // ==========================================
        // FETCH DOCUMENT REQUIREMENTS
        // ==========================================

        const requirements =
          await prisma.applicationDocumentRequirement.findMany({
            where: {
              loanApplicationId
            },
            include: {
              documentType: true,
              uploads: true
            },
            orderBy: {
              createdAt: "asc"
            }
          });

        // ==========================================
        // FORMAT RESPONSE
        // ==========================================

        const documents = requirements.map(req => ({
          requirementId: req.id,
          documentTypeId: req.documentTypeId,
          documentName: req.documentType?.name || "Document",
          status: req.status,
          uploadedFiles: req.uploads.map(u => ({
            id: u.id,
            fileName: u.fileName,
            fileUrl: u.fileUrl,
            uploadedAt: u.uploadedAt
          }))
        }));

        // ==========================================
        // SUCCESS RESPONSE
        // ==========================================

        clientLogs.info("Client upload token verified", {
          loanApplicationId
        });

        return reply.send({
          success: true,

          data: {
            loanApplicationId,
            applicationNumber: tokenRecord.loanApplication.applicationNumber,

            client: {
              id: tokenRecord.loanApplication.client.id,
              name: tokenRecord.loanApplication.client.legalName
            },

            documents
          }
        });

      } catch (error) {

        clientLogs.error("Token verification failed", error);

        return reply.status(500).send({
          success: false,
          message: "Server error verifying upload link"
        });
      }
    }
  );
}

module.exports = verifyTokenRoute;