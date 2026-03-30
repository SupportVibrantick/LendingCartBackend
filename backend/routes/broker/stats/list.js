// backend/routes/broker/stats/list.js

module.exports = async function brokerStatsList(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Broker -> Stats"],
        summary: "Get broker dashboard statistics",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        /* =====================================================
           1️⃣ AUTHORIZATION
        ===================================================== */

        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const brokerOrgId = req.user.organizationId;

        if (!brokerOrgId) {
          return reply.code(400).send({
            success: false,
            message: "Invalid broker organization",
          });
        }

        /* =====================================================
           2️⃣ PARALLEL CORE AGGREGATIONS + PRODUCT STATS
        ===================================================== */

        const [
          totalApplications,
          submittedCount,
          inReviewCount,
          approvedCount,
          declinedCount,
          fundedCount,
          withdrawnCount,
          fundedVolume,
          productWiseVolume,
        ] = await Promise.all([
          prisma.loanApplication.count({
            where: { brokerOrgId },
          }),

          prisma.loanApplication.count({
            where: { brokerOrgId, status: "SUBMITTED" },
          }),

          prisma.loanApplication.count({
            where: { brokerOrgId, status: "IN_REVIEW" },
          }),

          prisma.loanApplication.count({
            where: { brokerOrgId, status: "LENDER_APPROVED" },
          }),

          prisma.loanApplication.count({
            where: { brokerOrgId, status: "LENDER_DECLINED" },
          }),

          prisma.loanApplication.count({
            where: { brokerOrgId, status: "FUNDED" },
          }),

          prisma.loanApplication.count({
            where: { brokerOrgId, status: "WITHDRAWN" },
          }),

          prisma.loanApplication.aggregate({
            where: {
              brokerOrgId,
              status: "FUNDED",
            },
            _sum: {
              amountRequested: true,
            },
          }),

          // ✅ CHANGED: NOW BASED ON APPROVED
          prisma.loanApplication.groupBy({
            by: ["loanProductCode"],
            where: {
              brokerOrgId,
              status: "LENDER_APPROVED", // 🔥 KEY CHANGE
            },
            _sum: {
              amountRequested: true,
            },
          }),
        ]);

        /* =====================================================
           3️⃣ UNIQUE LENDERS COUNT
        ===================================================== */

        const uniqueLenders = await prisma.applicationLender.findMany({
          where: {
            loanApplication: {
              brokerOrgId,
            },
          },
          distinct: ["lenderOrgId"],
          select: {
            lenderOrgId: true,
          },
        });

        /* =====================================================
           4️⃣ FORMAT PRODUCT-WISE DATA
        ===================================================== */

        const productWiseStats = productWiseVolume.map((item) => ({
          product: item.loanProductCode,
          totalApprovedAmount: item._sum?.amountRequested ?? 0,
        }));

        /* =====================================================
           5️⃣ RESPONSE
        ===================================================== */

        return reply.send({
          success: true,
          data: {
            totalApplications,
            totalSubmitted: submittedCount,
            totalInReview: inReviewCount,
            totalApproved: approvedCount,
            totalDeclined: declinedCount,
            totalFunded: fundedCount,
            totalWithdrawn: withdrawnCount,
            totalVolumeFunded:
              fundedVolume?._sum?.amountRequested ?? 0,
            uniqueLendersAccessed: uniqueLenders.length,

            applicationsByStatus: {
              SUBMITTED: submittedCount,
              IN_REVIEW: inReviewCount,
              LENDER_APPROVED: approvedCount,
              LENDER_DECLINED: declinedCount,
              FUNDED: fundedCount,
              WITHDRAWN: withdrawnCount,
            },

            // ✅ NEW APPROVED-BASED PRODUCT STATS
            productWiseApprovedVolume: productWiseStats,
          },
        });

      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            stack: error.stack,
            brokerOrgId: req.user?.organizationId,
          },
          "Broker stats fetch failed"
        );

        return reply.code(500).send({
          success: false,
          message:
            "Internal server error while fetching broker stats",
        });
      }
    }
  );
};