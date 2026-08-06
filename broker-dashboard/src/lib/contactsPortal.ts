import {
  checkCoBrokerResponse,
  CO_BROKER_API_BASE,
  getCoBrokerAuthHeaders,
} from "./coBrokerPortal";
import {
  checkLoanOfficerResponse,
  LO_API_BASE,
  loAuthHeaders,
} from "./loanOfficerApi";
import { hasPermission } from "./brokerPermissions";

export type ContactsPortal = "loanOfficer" | "coBroker";

export type ContactsPortalConfig = {
  listUrl: (page: number, limit: number) => string;
  deleteUrl: (id: string) => string;
  createUrl: string;
  updateUrl: (id: string) => string;
  getHeaders: (json?: boolean) => Record<string, string>;
  checkResponse: (res: Response, json?: { message?: string }) => void;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  heroEyebrow: string;
  heroDescription: string;
};

export function getContactsPortalConfig(
  portal: ContactsPortal,
): ContactsPortalConfig {
  if (portal === "coBroker") {
    return {
      listUrl: (page, limit) =>
        `${CO_BROKER_API_BASE}/subbroker/contacts/list?page=${page}&limit=${limit}`,
      deleteUrl: (id) => `${CO_BROKER_API_BASE}/subbroker/contacts/${id}`,
      createUrl: `${CO_BROKER_API_BASE}/subbroker/contacts/create`,
      updateUrl: (id) => `${CO_BROKER_API_BASE}/subbroker/contacts/${id}/update`,
      getHeaders: (json = false) =>
        ({ ...getCoBrokerAuthHeaders(json ? "application/json" : "") }) as Record<
          string,
          string
        >,
      checkResponse: checkCoBrokerResponse,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      heroEyebrow: "User Management",
      heroDescription:
        "Manage lenders, partners, and contacts in your personal directory.",
    };
  }

  return {
    listUrl: (page, limit) =>
      `${LO_API_BASE}/loanofficer/contacts/list?page=${page}&limit=${limit}`,
    deleteUrl: (id) => `${LO_API_BASE}/loanofficer/contacts/${id}`,
    createUrl: `${LO_API_BASE}/loanofficer/contacts/create`,
    updateUrl: (id) => `${LO_API_BASE}/loanofficer/contacts/${id}/update`,
    getHeaders: (json = false) => loAuthHeaders(json),
    checkResponse: checkLoanOfficerResponse,
    canCreate: hasPermission("CREATE_CONTACTS", "loanOfficer"),
    canEdit: hasPermission("EDIT_CONTACTS", "loanOfficer"),
    canDelete: hasPermission("DELETE_CONTACTS", "loanOfficer"),
    heroEyebrow: "CRM · Directory",
    heroDescription:
      "Manage lenders, partners, and borrowers in your personal contact directory.",
  };
}
