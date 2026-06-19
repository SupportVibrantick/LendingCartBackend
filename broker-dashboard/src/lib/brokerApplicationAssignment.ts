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

  if (
    displayStatus === "APPROVED" ||
    ["LENDER_APPROVED", "AUTO_APPROVED"].includes(appStatus)
  ) {
    return false;
  }

  if (["FUNDED", "WITHDRAWN", "SUSPENDED"].includes(appStatus)) {
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
