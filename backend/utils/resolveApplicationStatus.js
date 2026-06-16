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

module.exports = {
  resolveApplicationStatus,
  resolveBrokerPipelineDisplayStatus,
  canBrokerEditSubmittedApplication,
};
