import type { ComponentType } from "react";
import { getPortalAuthHeaders } from "./portalAuth";
import BrokerLoanPreviewChat from "../pages/submitedApplications/LoanPreviewChat";
import BrokerFeeAgreement from "../pages/submitedApplications/FeeAgreement";
import BrokerLoanApplication from "../pages/LoanApplication/LoanApplication";
import LoanOfficerLoanPreviewChat from "../pages/loanOfficer/LoanPipeline/LoanPreviewChat";
import LoanOfficerFeeAgreement from "../pages/loanOfficer/LoanPipeline/FeeAgreement";
import LoanOfficerLoanApplication from "../pages/loanOfficer/LoanApplication/LoanApplication";

export type LoanPreviewPortal = "broker" | "loanOfficer";

export type LoanPreviewConfig = {
  portal: LoanPreviewPortal;
  pipelineApiRoot: string;
  lenderDiscoveryApiRoot: string;
  brokerApiRoot: string;
  submissionDetailUrl: (submissionId: string) => string;
  previewNavigatePath: string;
  commissionPortal: "broker" | "loanofficer";
  canMarkPaidCommission: boolean;
  showMarkFunded: boolean;
  showEmailReminders: boolean;
  Chat: ComponentType<{ applicationId?: string | null }>;
  FeeAgreement: ComponentType<any>;
  LoanApplication: ComponentType<any>;
  getAuthHeaders: () => HeadersInit;
};

export function getLoanPreviewConfig(
  portal: LoanPreviewPortal = "broker",
): LoanPreviewConfig {
  const pipelineApiRoot =
    portal === "loanOfficer" ? "loanofficer" : "broker";
  const lenderDiscoveryApiRoot =
    portal === "loanOfficer" ? "loanofficer" : "broker";

  if (portal === "loanOfficer") {
    return {
      portal,
      pipelineApiRoot,
      lenderDiscoveryApiRoot,
      brokerApiRoot: "broker",
      submissionDetailUrl: (submissionId) =>
        `/loanofficer/applications/submissions/${submissionId}`,
      previewNavigatePath: "/loan-officer/loan-pipeline-preview",
      commissionPortal: "loanofficer",
      canMarkPaidCommission: false,
      showMarkFunded: false,
      showEmailReminders: true,
      Chat: LoanOfficerLoanPreviewChat,
      FeeAgreement: LoanOfficerFeeAgreement,
      LoanApplication: LoanOfficerLoanApplication,
      getAuthHeaders: () => getPortalAuthHeaders(true),
    };
  }

  return {
    portal,
    pipelineApiRoot,
    lenderDiscoveryApiRoot,
    brokerApiRoot: "broker",
    submissionDetailUrl: (submissionId) =>
      `/api/public/broker/applications/submissions/${submissionId}`,
    previewNavigatePath: "/loan-preview",
    commissionPortal: "broker",
    canMarkPaidCommission: true,
    showMarkFunded: true,
    showEmailReminders: true,
    Chat: BrokerLoanPreviewChat,
    FeeAgreement: BrokerFeeAgreement,
    LoanApplication: BrokerLoanApplication,
    getAuthHeaders: () => getPortalAuthHeaders(true),
  };
}
