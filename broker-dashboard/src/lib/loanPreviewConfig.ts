import type { ComponentType } from "react";
import { getPortalAuthHeaders } from "./portalAuth";
import BrokerLoanPreviewChat from "../pages/submitedApplications/LoanPreviewChat";
import BrokerFeeAgreement from "../pages/submitedApplications/FeeAgreement";
import BrokerLoanApplication from "../pages/LoanApplication/LoanApplication";
import LoanOfficerLoanPreviewChat from "../pages/loanOfficer/LoanPipeline/LoanPreviewChat";
import LoanOfficerFeeAgreement from "../pages/loanOfficer/LoanPipeline/FeeAgreement";
import LoanOfficerLoanApplication from "../pages/loanOfficer/LoanApplication/LoanApplication";
import CoBrokerLoanPreviewChat from "../pages/subBroker/LoanPipeline/LoanPreviewChat";
import CoBrokerFeeAgreement from "../pages/subBroker/LoanPipeline/FeeAgreement";
import CoBrokerLoanApplication from "../pages/subBroker/LoanApplication/LoanApplication";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export type LoanPreviewPortal = "broker" | "loanOfficer" | "coBroker";

export type LoanPreviewApiUrls = {
  submissionDocuments: (submissionId: string, queryString: string) => string;
  submissionDocumentUpload: (
    submissionId: string,
    requirementId: string,
  ) => string;
  requestDocuments: (applicationId: string) => string;
  lois: (applicationId: string, queryString?: string) => string;
  submittedLenders: (applicationId: string) => string;
  documentsSubmitToLender: (submissionId: string) => string;
  documentsAutoForward: (submissionId: string) => string;
  documentsAutoForwardToClient: (submissionId: string) => string;
  documentsForwardToClient: (submissionId: string) => string;
  markFunded: (applicationId: string) => string;
  eligibleLenders: (submissionId: string, queryString: string) => string;
  sendToLenders: (applicationId: string, submissionId: string) => string;
  skipSubBrokerSubmission: (subBrokerSubmissionId: string) => string;
  sendDocumentToBroker: (requirementId: string) => string | null;
};

export type LoanPreviewConfig = {
  portal: LoanPreviewPortal;
  pipelineApiRoot: string;
  lenderDiscoveryApiRoot: string;
  brokerApiRoot: string;
  loiApiRole: "broker" | "loanofficer" | "subbroker";
  submissionDetailUrl: (submissionId: string) => string;
  previewNavigatePath: string;
  pipelineListPath: string;
  backLabel: string;
  commissionPortal: "broker" | "loanofficer" | "subbroker";
  canMarkPaidCommission: boolean;
  showMarkFunded: boolean;
  showEmailReminders: boolean;
  Chat: ComponentType<{ applicationId?: string | null }>;
  FeeAgreement: ComponentType<any>;
  LoanApplication: ComponentType<any>;
  getAuthHeaders: () => HeadersInit;
  api: LoanPreviewApiUrls;
};

function buildBrokerStyleApiUrls(
  pipelineApiRoot: "broker" | "loanofficer",
): LoanPreviewApiUrls {
  const pipelineApi = `${API_BASE}/${pipelineApiRoot}/loan-pipeline`;
  const brokerPipelineApi = `${API_BASE}/broker/loan-pipeline`;
  const lenderApi = `${API_BASE}/${pipelineApiRoot}/lender-discovery`;

  return {
    submissionDocuments: (submissionId, queryString) =>
      `${pipelineApi}/submissions/${submissionId}/documents?${queryString}`,
    submissionDocumentUpload: (submissionId, requirementId) =>
      `${pipelineApi}/submissions/${submissionId}/documents/${requirementId}/upload`,
    requestDocuments: (applicationId) =>
      `${pipelineApi}/${applicationId}/request-documents`,
    lois: (applicationId, queryString = "page=1&limit=1") =>
      `${pipelineApi}/${applicationId}/lois?${queryString}`,
    submittedLenders: (applicationId) =>
      `${pipelineApi}/${applicationId}/submitted-lenders`,
    documentsSubmitToLender: (submissionId) =>
      `${pipelineApi}/submissions/${submissionId}/documents/submit`,
    documentsAutoForward: (submissionId) =>
      `${pipelineApi}/submissions/${submissionId}/documents/auto-forward`,
    documentsAutoForwardToClient: (submissionId) =>
      `${brokerPipelineApi}/submissions/${submissionId}/documents/auto-forward-to-client`,
    documentsForwardToClient: (submissionId) =>
      `${brokerPipelineApi}/submissions/${submissionId}/documents/forward-to-client`,
    markFunded: (applicationId) =>
      `${brokerPipelineApi}/${applicationId}/mark-funded`,
    eligibleLenders: (submissionId, queryString) =>
      `${lenderApi}/applications/submissions/${submissionId}/eligible?${queryString}`,
    sendToLenders: (applicationId, submissionId) =>
      `${lenderApi}/applications/${applicationId}/submissions/${submissionId}/send-to-lenders`,
    skipSubBrokerSubmission: (subBrokerSubmissionId) =>
      `${brokerPipelineApi}/sub-broker-submissions/${subBrokerSubmissionId}/skip`,
    sendDocumentToBroker: () => null,
  };
}

function buildCoBrokerApiUrls(): LoanPreviewApiUrls {
  const docsApi = `${API_BASE}/subbroker/documents`;

  return {
    submissionDocuments: (submissionId, queryString) =>
      `${docsApi}/submissions/${submissionId}/documents?${queryString}`,
    submissionDocumentUpload: (submissionId, requirementId) =>
      `${docsApi}/submissions/${submissionId}/documents/${requirementId}/upload`,
    requestDocuments: (applicationId) =>
      `${docsApi}/${applicationId}/request-documents`,
    lois: (applicationId, queryString = "page=1&limit=10") =>
      `${API_BASE}/subbroker/view-loi/${applicationId}/lois?${queryString}`,
    submittedLenders: () => "",
    documentsSubmitToLender: () => "",
    documentsAutoForward: () => "",
    documentsAutoForwardToClient: () => "",
    documentsForwardToClient: () => "",
    markFunded: () => "",
    eligibleLenders: () => "",
    sendToLenders: () => "",
    skipSubBrokerSubmission: () => "",
    sendDocumentToBroker: (requirementId) =>
      `${docsApi}/${requirementId}/send-to-broker`,
  };
}

export function getLoanPreviewConfig(
  portal: LoanPreviewPortal = "broker",
): LoanPreviewConfig {
  if (portal === "coBroker") {
    return {
      portal,
      pipelineApiRoot: "subbroker",
      lenderDiscoveryApiRoot: "subbroker",
      brokerApiRoot: "broker",
      loiApiRole: "subbroker",
      submissionDetailUrl: (submissionId) =>
        `/api/public/broker/applications/submissions/${submissionId}`,
      previewNavigatePath: "/sub-broker/loan-pipeline-preview",
      pipelineListPath: "/sub-broker/loan-pipeline",
      backLabel: "Back to Loan Pipeline",
      commissionPortal: "subbroker",
      canMarkPaidCommission: false,
      showMarkFunded: false,
      showEmailReminders: false,
      Chat: CoBrokerLoanPreviewChat,
      FeeAgreement: CoBrokerFeeAgreement,
      LoanApplication: CoBrokerLoanApplication,
      getAuthHeaders: () => getPortalAuthHeaders(true),
      api: buildCoBrokerApiUrls(),
    };
  }

  if (portal === "loanOfficer") {
    return {
      portal,
      pipelineApiRoot: "loanofficer",
      lenderDiscoveryApiRoot: "loanofficer",
      brokerApiRoot: "broker",
      loiApiRole: "loanofficer",
      submissionDetailUrl: (submissionId) =>
        `/loanofficer/applications/submissions/${submissionId}`,
      previewNavigatePath: "/loan-officer/loan-pipeline-preview",
      pipelineListPath: "/loan-officer/loan-pipeline",
      backLabel: "Back to Loan Pipeline",
      commissionPortal: "loanofficer",
      canMarkPaidCommission: false,
      showMarkFunded: false,
      showEmailReminders: true,
      Chat: LoanOfficerLoanPreviewChat,
      FeeAgreement: LoanOfficerFeeAgreement,
      LoanApplication: LoanOfficerLoanApplication,
      getAuthHeaders: () => getPortalAuthHeaders(true),
      api: buildBrokerStyleApiUrls("loanofficer"),
    };
  }

  return {
    portal,
    pipelineApiRoot: "broker",
    lenderDiscoveryApiRoot: "broker",
    brokerApiRoot: "broker",
    loiApiRole: "broker",
    submissionDetailUrl: (submissionId) =>
      `/api/public/broker/applications/submissions/${submissionId}`,
    previewNavigatePath: "/loan-preview",
    pipelineListPath: "/submit-applications",
    backLabel: "Back to Submitted Applications",
    commissionPortal: "broker",
    canMarkPaidCommission: true,
    showMarkFunded: true,
    showEmailReminders: true,
    Chat: BrokerLoanPreviewChat,
    FeeAgreement: BrokerFeeAgreement,
    LoanApplication: BrokerLoanApplication,
    getAuthHeaders: () => getPortalAuthHeaders(true),
    api: buildBrokerStyleApiUrls("broker"),
  };
}
