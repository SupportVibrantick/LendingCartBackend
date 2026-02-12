/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function getApplicationDetails(fastify) {
  fastify.get(
    "/:applicationLenderId",
    {
      schema: {
        tags: ["Lender -> Loan Pipeline"],
        summary: "Get full application details for lender",
        params: {
          type: "object",
          required: ["applicationLenderId"],
          properties: {
            applicationLenderId: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        // ----------------------------------
        // 1️⃣ AUTH CHECK
        // ----------------------------------
        if (
          !req.user ||
          req.user.orgType !== "LENDER" ||
          !req.user.organizationId
        ) {
          return reply.status(403).send({
            success: false,
            message: "Lender access only",
          });
        }

        const lenderOrgId = req.user.organizationId;
        const { applicationLenderId } = req.params;

        // ----------------------------------
        // 2️⃣ FETCH APPLICATION LENDER RECORD
        // ----------------------------------
        const record = await prisma.applicationLender.findFirst({
          where: {
            id: applicationLenderId,
            lenderOrgId,
          },
          include: {
            loanApplication: {
              include: {
                client: true,
                brokerOrg: true,

                financials: true,
                collaterals: true,

                documentUploads: true,

                submissions: {
                  include: {
                    fields: true,
                  },
                },

                ruleEvaluations: {
                  include: {
                    results: true,
                  },
                },
              },
            },
            lenderProduct: true,
            lenderReviews: {
              include: {
                conditions: true,
              },
            },
          },
        });

        if (!record) {
          return reply.status(404).send({
            success: false,
            message: "Application not found for this lender",
          });
        }

        return reply.send({
          success: true,
          data: record,
        });
      } catch (error) {
        fastify.log.error(error);

        return reply.status(500).send({
          success: false,
          message: "Server error while fetching application details",
        });
      }
    }
  );
}

module.exports = getApplicationDetails;