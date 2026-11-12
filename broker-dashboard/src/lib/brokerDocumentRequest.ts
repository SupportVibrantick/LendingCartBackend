type BrokerSubmissionDetail = {
  canRequestDocuments?: boolean;
  documentRequestBlockedReason?: string | null;
  status?: string | null;
  applicationStatus?: string | null;
  pipelineStatus?: string | null;
};

/**
 * Brokers / LOs / co-brokers may always request documents, regardless of
 * approve/decline/LOI/funded status. Role/package permission checks stay
 * in the preview UI separately.
 */
export function canBrokerRequestDocuments(
  _detail?: BrokerSubmissionDetail | null,
): boolean {
  return true;
}

export function getBrokerRequestDocumentsDisabledReason(
  _detail?: BrokerSubmissionDetail | null,
): string {
  return "";
}
