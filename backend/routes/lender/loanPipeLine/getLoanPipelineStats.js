/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function getLoanPipelineStats(fastify) {
  fastify.get(
    "/stats",
    {
      schema: {
        tags: ["Lender -> Loan Pipeline"],
        summary: "Get Loan Pipeline Stats",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        // ===============================
        // AUTH CHECK
        // ===============================
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

        // ===============================
        // FETCH APPLICATIONS
        // ===============================
        const applications = await prisma.applicationLender.findMany({
          where: {
            lenderOrgId,
          },

          include: {
            loanApplication: {
              include: {
                submissions: {
                  take: 1,

                  include: {
                    fields: true,
                  },
                },
              },
            },

            lenderReviews: {
              orderBy: {
                createdAt: "desc",
              },

              select: {
                reviewStatus: true,
              },
            },
          },
        });

        // ===============================
        // STATS
        // ===============================
        const totalApplications = applications.length;

        const newApplications = applications.filter(
          (a) => a.status === "SENT" || a.status === "IN_REVIEW",
        ).length;

        const approvedApplications = applications.filter((a) => {
          const latestReview = a.lenderReviews?.[0];

          return latestReview?.reviewStatus === "APPROVED";
        }).length;

        const totalVolume = applications.reduce((sum, app) => {
          const fields = app.loanApplication?.submissions?.[0]?.fields || [];

          const amountField = fields.find((f) =>
            ["amountRequested", "loan_amount"].includes(
              f.builderField?.fieldKey || f.fieldKey,
            ),
          );

          return sum + Number(amountField?.value || 0);
        }, 0);

        return reply.send({
          success: true,
          data: {
            totalApplications,
            newApplications,
            approvedApplications,
            totalVolume,
          },
        });
      } catch (error) {
        fastify.log.error(error);

        return reply.status(500).send({
          success: false,
          message: error.message || "Failed to fetch loan pipeline stats",
        });
      }
    },
  );
}

module.exports = getLoanPipelineStats;
