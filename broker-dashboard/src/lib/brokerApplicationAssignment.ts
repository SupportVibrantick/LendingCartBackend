type BrokerPipelineRow = {
  canReassignApplication?: boolean;
  reassignmentBlockedReason?: string | null;
  status?: string | null;
  applicationStatus?: string | null;
  pipelineStatus?: string | null;
};

export function canBrokerReassignApplication(
  row?: BrokerPipelineRow | null,
): boolean {
  if (!row) return true;

  if (row.canReassignApplication === false) return false;
  if (row.canReassignApplication === true) return true;

  const displayStatus = (row.pipelineStatus || row.status || "")
    .toUpperCase()
    .trim();
  const appStatus = (row.applicationStatus || "").toUpperCase().trim();

  const blockedApplicationStatuses = [
    "AUTO_APPROVED",
    "LENDER_APPROVED",
    "FUNDED",
    "WITHDRAWN",
    "SUSPENDED",
  ];
  
  if (
    displayStatus === "APPROVED" ||
    displayStatus === "FUNDED" ||
    blockedApplicationStatuses.includes(appStatus)
  ) {
    return false;
  }

  return true;
}

export function getBrokerReassignmentBlockedReason(
  row?: BrokerPipelineRow | null,
): string {
  if (row?.reassignmentBlockedReason) {
    return row.reassignmentBlockedReason;
  }

  if (!canBrokerReassignApplication(row)) {
    const displayStatus = (row?.pipelineStatus || row?.status || "")
      .toUpperCase()
      .trim();

    if (displayStatus === "APPROVED") {
      return "Officer and sub broker cannot be changed after a lender has approved this application.";
    }

    return "Officer and sub broker cannot be changed for this application.";
  }

  return "";
}
