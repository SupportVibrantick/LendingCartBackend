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

        const token = (req.params.token || "").trim();

        if (!token) {
          return reply.status(400).send({
            success: false,
            message: "Token is required"
          });
        }

        // ==========================================
        // FIND TOKEN
        // ==========================================

        const tokenRecord = await prisma.clientUploadToken.findUnique({
          where: { token },
          select: {
            id: true,
            loanApplicationId: true,
            expiresAt: true,
            isUsed: true,
            loanApplication: {
              select: {
                applicationNumber: true,
                client: {
                  select: {
                    id: true,
                    legalName: true
                  }
                }
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
        // EXPIRE CHECK
        // ==========================================

        if (tokenRecord.expiresAt < new Date()) {
          return reply.status(400).send({
            success: false,
            message: "Upload link expired"
          });
        }

        // ==========================================
        // USED TOKEN CHECK
        // ==========================================

        if (tokenRecord.isUsed) {
          return reply.status(400).send({
            success: false,
            message: "Upload link already used"
          });
        }

        if (!tokenRecord.loanApplication) {
          return reply.status(404).send({
            success: false,
            message: "Loan application not found"
          });
        }

        const loanApplicationId = tokenRecord.loanApplicationId;

        // ==========================================
        // FETCH DOCUMENT REQUIREMENTS
        // ==========================================

        const requirements =
          await prisma.applicationDocumentRequirement.findMany({
            where: { loanApplicationId },
            select: {
              id: true,
              documentTypeId: true,
              status: true,
              documentType: {
                select: {
                  name: true
                }
              },
              uploads: {
                select: {
                  id: true,
                  fileName: true,
                  fileUrl: true,
                  uploadedAt: true
                }
              }
            },
            orderBy: {
              createdAt: "asc"
            }
          });

        // ==========================================
        // FORMAT DOCUMENT RESPONSE
        // ==========================================

        const documents = requirements.map((r) => ({
          requirementId: r.id,
          documentTypeId: r.documentTypeId,
          documentName: r.documentType?.name || "Document",
          status: r.status,

          uploadedFiles: (r.uploads || []).map((u) => ({
            id: u.id,
            fileName: u.fileName,
            fileUrl: u.fileUrl,
            uploadedAt: u.uploadedAt
          }))
        }));

        // ==========================================
        // SUCCESS RESPONSE
        // ==========================================

        console.log("Client upload token verified", {
          loanApplicationId,
          tokenId: tokenRecord.id
        });

        return reply.send({
          success: true,
          data: {
            loanApplicationId,

            applicationNumber:
              tokenRecord.loanApplication.applicationNumber || null,

            client: tokenRecord.loanApplication.client
              ? {
                  id: tokenRecord.loanApplication.client.id,
                  name: tokenRecord.loanApplication.client.legalName
                }
              : null,

            documents
          }
        });

      } catch (error) {

        console.error("VERIFY TOKEN ERROR:", error);

        return reply.status(500).send({
          success: false,
          message: "Server error verifying upload link"
        });
      }
    }
  );
}

module.exports = verifyTokenRoute;