/**
 * Derive the effective loan application status from the root record
 * and linked lender decisions (applicationLenders).
 */
function resolveApplicationStatus(application) {
  if (!application) {
    return null;
  }

  const status = application.status;
  const lenders = application.applicationLenders || [];

  if (["FUNDED", "WITHDRAWN", "SUSPENDED"].includes(status)) {
    return status;
  }

  if (["LENDER_APPROVED", "AUTO_APPROVED"].includes(status)) {
    return status;
  }

  if (lenders.some((lender) => lender.status === "APPROVED")) {
    return "LENDER_APPROVED";
  }

  if (["LENDER_DECLINED", "AUTO_DECLINED"].includes(status)) {
    return status;
  }

  if (
    lenders.length > 0 &&
    lenders.every((lender) => lender.status === "DECLINED")
  ) {
    return "LENDER_DECLINED";
  }

  return status;
}

/**
 * Status label shown in broker loan pipeline tables (matches listSubmissions).
 */
function resolveBrokerPipelineDisplayStatus(application) {
  if (!application) {
    return null;
  }

  const lenders = application.applicationLenders || [];

  if (application.status === "FUNDED") {
    return "FUNDED";
  }

  if (lenders.some((lender) => lender.status === "APPROVED")) {
    return "APPROVED";
  }

  if (
    lenders.length > 0 &&
    lenders.every((lender) => lender.status === "DECLINED")
  ) {
    return "DECLINED";
  }

  return application.status;
}

function countBrokerPipelineStats(submissions) {
  const counts = {
    approved: 0,
    rejected: 0,
    inReview: 0,
    draft: 0,
    submitted: 0,
    clientPending: 0,
    newApplications: 0,
    funded: 0,
  };

  for (const submission of submissions || []) {
    const displayStatus = resolveBrokerPipelineDisplayStatus(
      submission.application,
    );

    switch (displayStatus) {
      case "APPROVED":
        counts.approved += 1;
        break;
      case "FUNDED":
        counts.funded += 1;
        break;
      case "DECLINED":
        counts.rejected += 1;
        break;
      case "IN_REVIEW":
        counts.inReview += 1;
        break;
      case "DRAFT":
        counts.draft += 1;
        break;
      case "SUBMITTED":
        counts.submitted += 1;
        break;
      case "CLIENT_PENDING":
        counts.clientPending += 1;
        break;
      case "NEW":
        counts.newApplications += 1;
        break;
      default:
        break;
    }
  }

  return counts;
}

function buildBrokerPipelineApplicationStatusWhere(status) {
  if (!status) {
    return {};
  }

  if (status === "APPROVED") {
    return {
      AND: [
        { status: { not: "FUNDED" } },
        {
          applicationLenders: {
            some: { status: "APPROVED" },
          },
        },
      ],
    };
  }

  if (status === "FUNDED") {
    return { status: "FUNDED" };
  }

  if (status === "DECLINED") {
    return {
      AND: [
        { applicationLenders: { some: {} } },
        {
          applicationLenders: {
            every: { status: "DECLINED" },
          },
        },
      ],
    };
  }

  if (status === "SUBMITTED") {
    return {
      AND: [
        { status: "SUBMITTED" },
        {
          NOT: {
            applicationLenders: {
              some: { status: "APPROVED" },
            },
          },
        },
        {
          OR: [
            { applicationLenders: { none: {} } },
            {
              NOT: {
                applicationLenders: {
                  every: { status: "DECLINED" },
                },
              },
            },
          ],
        },
      ],
    };
  }

  return { status };
}

/**
 * Whether a broker may edit a submitted application payload.
 */
function canBrokerEditSubmittedApplication(application) {
  if (!application) {
    return {
      allowed: false,
      reason: "Application not found",
    };
  }

  const lenders = application.applicationLenders || [];
  const displayStatus = resolveBrokerPipelineDisplayStatus(application);
  const status = application.status;

  if (displayStatus === "APPROVED" || resolveApplicationStatus(application) === "LENDER_APPROVED") {
    return {
      allowed: false,
      reason: "This application cannot be edited after a lender has approved it.",
    };
  }

  if (displayStatus === "DECLINED") {
    return {
      allowed: false,
      reason: "This application cannot be edited after all lenders declined it.",
    };
  }

  if (["FUNDED", "WITHDRAWN", "SUSPENDED", "LENDER_APPROVED", "AUTO_APPROVED"].includes(status)) {
    return {
      allowed: false,
      reason: `Editing not allowed for status: ${status}`,
    };
  }

  if (["SUBMITTED", "IN_REVIEW", "CLIENT_PENDING", "DRAFT"].includes(status)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Editing not allowed for status: ${status}`,
  };
}

/**
 * Whether a broker may request additional documents from the client.
 */
function canBrokerRequestDocuments(application) {
  if (!application) {
    return {
      allowed: false,
      reason: "Application not found",
    };
  }

  const displayStatus = resolveBrokerPipelineDisplayStatus(application);
  const status = application.status;
  const resolvedStatus = resolveApplicationStatus(application);

  if (displayStatus === "DECLINED" || resolvedStatus === "LENDER_DECLINED") {
    return {
      allowed: false,
      reason: "Documents cannot be requested for a declined application.",
    };
  }

  if (["FUNDED", "WITHDRAWN", "SUSPENDED"].includes(status)) {
    return {
      allowed: false,
      reason: `Documents cannot be requested for status: ${status}`,
    };
  }

  return { allowed: true };
}

/**
 * Whether a broker may assign or change loan officer / sub broker.
 */
function canBrokerReassignApplication(application) {
  if (!application) {
    return {
      allowed: false,
      reason: "Application not found",
    };
  }

  const displayStatus = resolveBrokerPipelineDisplayStatus(application);
  const status = application.status;
  const resolvedStatus = resolveApplicationStatus(application);

  if (
    displayStatus === "APPROVED" ||
    ["LENDER_APPROVED", "AUTO_APPROVED"].includes(resolvedStatus)
  ) {
    return {
      allowed: false,
      reason:
        "Officer and sub broker cannot be changed after a lender has approved this application.",
    };
  }

  if (["FUNDED", "WITHDRAWN", "SUSPENDED"].includes(status)) {
    return {
      allowed: false,
      reason: `Assignment cannot be changed for status: ${status}`,
    };
  }

  return { allowed: true };
}

module.exports = {
  resolveApplicationStatus,
  resolveBrokerPipelineDisplayStatus,
  countBrokerPipelineStats,
  buildBrokerPipelineApplicationStatusWhere,
  canBrokerEditSubmittedApplication,
  canBrokerRequestDocuments,
  canBrokerReassignApplication,
};
