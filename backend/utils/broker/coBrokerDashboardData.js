const {
  ANALYTICS_APPLICATION_SELECT,
  createAnalyticsEngine,
} = require("./dashboardPeriodAnalytics");

function subBrokerAssignedWhere(userId) {
  if (!userId) return { id: { in: [] } };
  return {
    subBrokerAssignments: {
      some: { subBrokerId: userId },
    },
  };
}

async function fetchCoBrokerPipelineStats(
  prisma,
  { userId, orgId, period = "12m" },
) {
  const engine = createAnalyticsEngine(period);
  const { period: resolvedPeriod, previousPeriod } = engine;

  const applications = await prisma.loanApplication.findMany({
    where: {
      brokerOrgId: orgId,
      AND: [
        subBrokerAssignedWhere(userId),
        {
          OR: [
            {
              createdAt: {
                gte: previousPeriod.start,
                lte: resolvedPeriod.end,
              },
            },
            {
              submittedAt: {
                gte: previousPeriod.start,
                lte: resolvedPeriod.end,
              },
            },
            {
              fundedAt: {
                gte: previousPeriod.start,
                lte: resolvedPeriod.end,
              },
            },
          ],
        },
      ],
    },
    select: ANALYTICS_APPLICATION_SELECT,
  });

  for (const application of applications) {
    engine.add(application);
  }

  const analytics = engine.finalize();

  return {
    ...analytics,
    totalVolume: analytics.totalVolumeFunded,
    submitted: analytics.totalSubmitted,
    clientPending: analytics.applicationsByStatus.CLIENT_PENDING || 0,
    approved: analytics.totalApproved,
    rejected: analytics.totalDeclined,
    inReview: analytics.totalInReview,
    draft: analytics.applicationsByStatus.DRAFT || 0,
    newApplications: 0,
  };
}

module.exports = {
  fetchCoBrokerPipelineStats,
  subBrokerAssignedWhere,
};
