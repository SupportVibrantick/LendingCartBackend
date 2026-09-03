const {
  officerAssignedApplicationWhere,
} = require("../../services/broker/loanOfficerAccess");
const {
  countBrokerPipelineStats,
  resolveBrokerPipelineDisplayStatus,
} = require("../applications/resolveApplicationStatus");

async function fetchLoanOfficerPipelineStats(prisma, { userId, orgId }) {
  const whereCondition = {
    brokerOrgId: orgId,
    ...officerAssignedApplicationWhere(userId),
  };

  const applications = await prisma.applicationSubmission.findMany({
    where: {
      status: { not: "SUPERSEDED" },
      application: whereCondition,
    },
    include: {
      fields: { include: { builderField: true } },
      application: {
        select: {
          id: true,
          amountRequested: true,
          status: true,
          applicationLenders: { select: { status: true } },
        },
      },
    },
  });

  const totalVolume = applications.reduce((sum, submission) => {
    const amountField = submission.fields.find(
      (f) =>
        f.builderField?.fieldKey === "amountRequested" ||
        f.builderField?.fieldKey === "loan_amount" ||
        f.fieldKey === "amountRequested" ||
        f.fieldKey === "loan_amount",
    );
    const rawAmount =
      amountField?.value || submission.application?.amountRequested || 0;
    const parsedAmount = Number(String(rawAmount).replace(/[$,]/g, "").trim());
    return Number(sum || 0) + (Number.isNaN(parsedAmount) ? 0 : parsedAmount);
  }, 0);

  const statusCounts = countBrokerPipelineStats(applications);

  return {
    totalVolume,
    totalApplications: applications.length,
    newApplications: statusCounts.newApplications,
    submitted: statusCounts.submitted,
    clientPending: statusCounts.clientPending,
    approved: statusCounts.approved,
    rejected: statusCounts.rejected,
    inReview: statusCounts.inReview,
    draft: statusCounts.draft,
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

async function fetchLoanOfficerRecentApplications(prisma, { userId, orgId, limit = 5 }) {
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
          status: true,
          applicationLenders: { select: { status: true } },
          client: { select: { legalName: true } },
        },
      },
    },
  });

  return submissions.map((submission) => {
    const app = submission.application;
    const borrower =
      getFieldValue(submission.fields, "borrowerName", "legalName") ||
      app?.client?.legalName ||
      "Applicant";
    const amount =
      getFieldValue(submission.fields, "amountRequested", "loan_amount") ||
      app?.amountRequested ||
      "0";

    return {
      submissionId: submission.id,
      applicationId: app?.id,
      applicationNumber: app?.applicationNumber,
      borrower,
      amount: String(amount),
      status: resolveBrokerPipelineDisplayStatus(app),
      submittedOn: submission.createdAt,
    };
  });
}

module.exports = {
  fetchLoanOfficerPipelineStats,
  fetchLoanOfficerRecentApplications,
};
