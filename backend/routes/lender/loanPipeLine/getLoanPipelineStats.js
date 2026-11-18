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

        const [totalApplications, newApplications, approvedRows, volumeRows] =
          await Promise.all([
            prisma.applicationLender.count({
              where: { lenderOrgId },
            }),
            prisma.applicationLender.count({
              where: {
                lenderOrgId,
                status: { in: ["SENT", "IN_REVIEW"] },
              },
            }),
            // Latest review status must be APPROVED (not merely "has an approved review").
            prisma.$queryRaw`
              SELECT COUNT(*)::int AS count
              FROM "application_lenders" al
              WHERE al."lenderOrgId" = ${lenderOrgId}::uuid
                AND (
                  SELECT lr."reviewStatus"::text
                  FROM "lender_reviews" lr
                  WHERE lr."applicationLenderId" = al.id
                  ORDER BY lr."createdAt" DESC
                  LIMIT 1
                ) = 'APPROVED'
            `,
            prisma.$queryRaw`
              SELECT COALESCE(SUM(la."amountRequested"), 0) AS total
              FROM "application_lenders" al
              INNER JOIN "loan_applications" la
                ON la.id = al."loanApplicationId"
              WHERE al."lenderOrgId" = ${lenderOrgId}::uuid
            `,
          ]);

        const approvedApplications = Number(approvedRows?.[0]?.count || 0);
        const totalVolume = Number(volumeRows?.[0]?.total || 0);

        return reply.send({
          success: true,
          data: {
            totalApplications,
            newApplications,
            approvedApplications,
            totalVolume: Number.isFinite(totalVolume) ? totalVolume : 0,
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
