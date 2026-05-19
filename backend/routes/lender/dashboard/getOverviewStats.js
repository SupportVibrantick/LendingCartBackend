const {
  consolidateApplicationLenders,
  percentage,
} = require("./dashboardAnalytics");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function getOverviewStats(
  fastify,
) {
  fastify.get(
    "/",
    async (req, reply) => {
      try {
        /* ===============================
           AUTH CHECK
        =============================== */
        if (
          !req.user ||
          req.user.orgType !== "LENDER"
        ) {
          return reply.code(403).send({
            success: false,
            message: "Lender access only",
          });
        }

        const lenderOrgId =
          req.user.organizationId;

        const [
          applicationLenders,
          activeProducts,
          activeConnections,
        ] = await Promise.all([
          fastify.prisma.applicationLender.findMany({
            where: {
              lenderOrgId,
            },
            select: {
              loanApplicationId: true,
              status: true,
              sentAt: true,
              lastUpdatedAt: true,
              loanApplication: {
                select: {
                  id: true,
                  brokerOrgId: true,
                  status: true,
                  amountRequested: true,
                  createdAt: true,
                },
              },
            },
          }),
          fastify.prisma.lenderProduct.count({
            where: {
              lenderOrgId,
              isActive: true,
            },
          }),
          fastify.prisma.brokerLenderAccess.count({
            where: {
              lenderOrgId,
              isActive: true,
            },
          }),
        ]);

        const consolidatedApplications =
          consolidateApplicationLenders(
            applicationLenders,
          );

        const totalApplications =
          consolidatedApplications.length;

        const pendingReview =
          consolidatedApplications.filter(
            (item) =>
              item.effectiveStatus ===
              "IN_REVIEW",
          ).length;

        const approved =
          consolidatedApplications.filter(
            (item) =>
              item.effectiveStatus ===
              "APPROVED",
          ).length;

        const declined =
          consolidatedApplications.filter(
            (item) =>
              item.effectiveStatus ===
              "DECLINED",
          ).length;

        const fundedLoans =
          consolidatedApplications.filter(
            (item) =>
              item.effectiveStatus ===
              "FUNDED",
          ).length;

        const sentToLender =
          consolidatedApplications.filter(
            (item) =>
              item.effectiveStatus !==
              "WITHDRAWN",
          ).length;

        const totalFundedVolume =
          consolidatedApplications
            .filter(
              (item) =>
                item.effectiveStatus ===
                "FUNDED",
            )
            .reduce(
              (sum, item) =>
                sum +
                Number(
                  item.amountRequested || 0,
                ),
              0,
            );

        const totalRequestedVolume =
          consolidatedApplications.reduce(
            (sum, item) =>
              sum +
              Number(
                item.amountRequested || 0,
              ),
            0,
          );

        const avgLoanSize =
          totalApplications > 0
            ? Number(
                (
                  totalRequestedVolume /
                  totalApplications
                ).toFixed(2),
              )
            : 0;

        const uniqueBrokerIds =
          [
            ...new Set(
              consolidatedApplications
                .map(
                  (item) =>
                    item.loanApplication
                      ?.brokerOrgId,
                )
                .filter(Boolean),
            ),
          ];

        const approvalRate =
          percentage(
            approved + fundedLoans,
            totalApplications,
            0,
          );

        const fundedRate =
          percentage(
            fundedLoans,
            totalApplications,
            0,
          );

        /* ===============================
           RESPONSE
        =============================== */
        return reply.send({
          success: true,

          data: {
            totalApplications,

            pendingReview,

            approved,

            declined,

            fundedLoans,

            totalFundedVolume,

            avgLoanSize,

            sentToLender,

            activeProducts,

            activeConnections,

            fundedRate,

            activeBrokers:
              uniqueBrokerIds.length,

            approvalRate,
          },
        });
      } catch (error) {
        fastify.log.error({
          route:
            "lender-overview-stats",

          error: error.message,

          stack: error.stack,
        });

        return reply.code(500).send({
          success: false,
          message: error.message || "Failed to fetch dashboard stats",
        });
      }
    },
  );
};
