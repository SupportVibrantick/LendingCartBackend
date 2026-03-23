const dayjs = require("dayjs");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */

async function getClientLoanDetailsRoute(fastify) {
  fastify.get(
    "/:token",
    {
      schema: {
        tags: ["Client Portal"],
        summary: "Get loan details using client token",
        params: {
          type: "object",
          required: ["token"],
          properties: {
            token: { type: "string" },
          },
        },
      },
    },

    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        const { token } = req.params;

        /* ===============================
           VALIDATE TOKEN
        =============================== */

        const tokenRecord = await prisma.clientUploadToken.findUnique({
          where: { token },
          include: {
            loanApplication: {
              include: {
                documentRequirements: {
                  include: {
                    documentType: true,
                    uploads: true,
                  },
                },
              },
            },
          },
        });

        if (!tokenRecord) {
          return reply.code(404).send({
            success: false,
            message: "Invalid access link",
          });
        }

        if (tokenRecord.expiresAt < new Date()) {
          return reply.code(400).send({
            success: false,
            message: "Link expired",
          });
        }

        const loan = tokenRecord.loanApplication;

        if (!loan) {
          return reply.code(404).send({
            success: false,
            message: "Loan not found",
          });
        }

        /* ===============================
           FORMAT RESPONSE
        =============================== */

        const response = {
          applicationNumber: loan.applicationNumber,
          status: loan.status,
          createdAt: dayjs(loan.createdAt).format("DD MMM YYYY"),
          amountRequested: loan.amountRequested,
          loanProductCode: loan.loanProductCode,

          documents: loan.documentRequirements.map((doc) => ({
            id: doc.id,
            name: doc.documentType.name,
            status: doc.status,
            required: doc.isRequired,
            uploadedFiles: doc.uploads.map((file) => ({
              fileName: file.fileName,
              fileUrl: file.fileUrl,
              uploadedAt: file.uploadedAt,
            })),
          })),
        };

        return reply.send({
          success: true,
          data: response,
        });
      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            token: req.params.token,
          },
          "Failed to fetch client loan details"
        );

        return reply.code(500).send({
          success: false,
          message: "Unexpected server error",
        });
      }
    }
  );
}

module.exports = getClientLoanDetailsRoute;