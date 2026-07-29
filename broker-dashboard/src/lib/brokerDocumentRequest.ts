type BrokerSubmissionDetail = {
  canRequestDocuments?: boolean;
  documentRequestBlockedReason?: string | null;
  status?: string | null;
  applicationStatus?: string | null;
  pipelineStatus?: string | null;
};

export function canBrokerRequestDocuments(
  detail?: BrokerSubmissionDetail | null,
): boolean {
  if (!detail) return true;

  if (detail.canRequestDocuments === false) return false;
  if (detail.canRequestDocuments === true) return true;

  const displayStatus = (detail.pipelineStatus || detail.status || "")
    .toUpperCase()
    .trim();
  const appStatus = (detail.applicationStatus || "").toUpperCase().trim();

  if (displayStatus === "DECLINED" || appStatus === "LENDER_DECLINED") {
    return false;
  }

  if (["FUNDED", "WITHDRAWN", "SUSPENDED"].includes(appStatus)) {
    return false;
  }

  return true;
}

export function getBrokerRequestDocumentsDisabledReason(
  detail?: BrokerSubmissionDetail | null,
): string {
  if (detail?.documentRequestBlockedReason) {
    return detail.documentRequestBlockedReason;
  }

  if (!canBrokerRequestDocuments(detail)) {
    const displayStatus = (detail?.pipelineStatus || detail?.status || "")
      .toUpperCase()
      .trim();

    if (displayStatus === "DECLINED") {
      return "Documents cannot be requested for a declined application.";
    }

    return "Documents cannot be requested for this application.";
  }

  return "";
}
