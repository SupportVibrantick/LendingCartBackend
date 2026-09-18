const {
  officerAssignedApplicationWhere,
} = require("../../services/broker/loanOfficerAccess");
const {
  resolveBrokerPipelineDisplayStatus,
} = require("../applications/resolveApplicationStatus");
const {
  ANALYTICS_APPLICATION_SELECT,
  createAnalyticsEngine,
} = require("./dashboardPeriodAnalytics");

async function fetchLoanOfficerPipelineStats(
  prisma,
  { userId, orgId, period = "12m" },
) {
  const engine = createAnalyticsEngine(period);
  const { period: resolvedPeriod, previousPeriod } = engine;

  const applications = await prisma.loanApplication.findMany({
    where: {
      brokerOrgId: orgId,
      AND: [
        officerAssignedApplicationWhere(userId),
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

  // Keep legacy aliases used by older LO dashboard consumers.
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

function getFieldValue(fields, ...keys) {
  for (const key of keys) {
    const field = fields.find(
      (f) => f.builderField?.fieldKey === key || f.fieldKey === key,
    );
    if (field?.value) return field.value;
  }
  return null;
}

async function fetchLoanOfficerRecentApplications(
  prisma,
  { userId, orgId, limit = 5 },
) {
  const submissions = await prisma.applicationSubmission.findMany({
    where: {
      status: { not: "SUPERSEDED" },
      application: {
        brokerOrgId: orgId,
        ...officerAssignedApplicationWhere(userId),
      },
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 20),
    include: {
      fields: { include: { builderField: true } },
      application: {
        select: {
          id: true,
          applicationNumber: true,
          amountRequested: true,
          loanProductCode: true,
          status: true,
          applicationLenders: {
            select: {
              status: true,
              lender: { select: { name: true } },
            },
          },
          client: { select: { legalName: true } },
        },
      },
    },
  });

  return submissions.map((submission) => {
    const app = submission.application;
    const borrower =
      [
        getFieldValue(submission.fields, "borrowerFirstName", "firstName"),
        getFieldValue(submission.fields, "borrowerLastName", "lastName"),
      ]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      getFieldValue(
        submission.fields,
        "borrowerName",
        "applicantName",
        "fullName",
        "legalName",
      ) ||
      app?.client?.legalName ||
      "Applicant";

    const amount =
      getFieldValue(submission.fields, "amountRequested", "loan_amount") ||
      app?.amountRequested ||
      "0";

    const lenders = app?.applicationLenders || [];
    const primaryLender =
      lenders.find((lender) => lender.status === "APPROVED") || lenders[0];

    return {
      submissionId: submission.id,
      applicationId: app?.id,
      applicationNumber: app?.applicationNumber,
      borrower,
      amount: String(amount),
      status: resolveBrokerPipelineDisplayStatus(app),
      submittedOn: submission.createdAt,
      loanInfo: app?.loanProductCode || null,
      lenderName: primaryLender?.lender?.name || null,
    };
  });
}

module.exports = {
  fetchLoanOfficerPipelineStats,
  fetchLoanOfficerRecentApplications,
};
