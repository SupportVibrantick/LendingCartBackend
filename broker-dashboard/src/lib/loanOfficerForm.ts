import {
  FINDERS_FEE_OPTIONS,
  PREFERRED_COMMUNICATION,
} from "./coBrokerForm";
import {
  ALL_LO_PERMISSION_KEYS,
  LO_HIDDEN_PERMISSION_KEYS,
  US_STATES,
  formatPhone,
  normalizeLoanOfficerPermissions,
} from "../pages/UserManagement/loanOfficerShared";

export { US_STATES, formatPhone, FINDERS_FEE_OPTIONS, PREFERRED_COMMUNICATION };

export const STATE_OPTIONS = US_STATES.map((state) => ({
  value: state.code,
  text: state.name,
}));

export interface LoanOfficerCoBroker {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  profileImage?: string | null;
}

export interface LoanOfficerProfile {
  company?: string;
  tollFree?: string | null;
  tollFreeExt?: string | null;
  serviceProvider?: string | null;
  address?: string;
  suite?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  agentType?: string | null;
  licenseNumber?: string;
  preferredComm?: string;
  website?: string;
  avatarUrl?: string | null;
  w9Url?: string | null;
  findersFee?: string;
  ein?: string;
  dre?: string;
  hasCompanyNmls?: boolean;
  companyNmls?: string;
  hasPersonalNmls?: boolean;
  personalNmls?: string;
  hasCompanyStateLicense?: boolean;
  companyStateLicenseStates?: string[];
  companyStateLicense?: string;
  hasPersonalStateLicense?: boolean;
  personalStateLicenseStates?: string[];
  personalStateLicense?: string;
  statesAuthorized?: string[];
  branchIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface LoanOfficerDetail {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: string;
  createdAt: string;
  lastLoginAt?: string | null;
  assignedDeals?: number;
  assignedCoBrokers?: LoanOfficerCoBroker[];
  assignedCoBrokerIds?: string[];
  roles?: string[];
  permissions?: string[];
  profile?: LoanOfficerProfile | null;
}

export interface LoanOfficerFormState {
  email: string;
  confirmEmail: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  phone: string;
  allowedToLogin: boolean;
  company: string;
  address: string;
  licenseNumber: string;
  ein: string;
  preferredComm: string;
  website: string;
  hasCompanyNmls: boolean;
  companyNmls: string;
  hasPersonalNmls: boolean;
  personalNmls: string;
  hasCompanyStateLicense: boolean;
  companyStateLicenseStates: string[];
  companyStateLicense: string;
  hasPersonalStateLicense: boolean;
  personalStateLicenseStates: string[];
  personalStateLicense: string;
  findersFee: string;
  statesAuthorized: string[];
  dre: string;
  branchIds: string[];
  permissions: string[];
  assignedCoBrokerIds: string[];
  avatarFile: File | null;
  avatarPreview: string | null;
  w9File: File | null;
}

export type LoanOfficerFormErrors = Partial<Record<keyof LoanOfficerFormState, string>>;

export const INITIAL_LOAN_OFFICER_FORM: LoanOfficerFormState = {
  email: "",
  confirmEmail: "",
  password: "",
  confirmPassword: "",
  firstName: "",
  lastName: "",
  phone: "",
  allowedToLogin: true,
  company: "",
  address: "",
  licenseNumber: "",
  ein: "",
  preferredComm: "",
  website: "",
  hasCompanyNmls: false,
  companyNmls: "",
  hasPersonalNmls: false,
  personalNmls: "",
  hasCompanyStateLicense: false,
  companyStateLicenseStates: [],
  companyStateLicense: "",
  hasPersonalStateLicense: false,
  personalStateLicenseStates: [],
  personalStateLicense: "",
  findersFee: "",
  statesAuthorized: [],
  dre: "",
  branchIds: [],
  permissions: [],
  assignedCoBrokerIds: [],
  avatarFile: null,
  avatarPreview: null,
  w9File: null,
};

export function mapDetailToLoanOfficerForm(detail: LoanOfficerDetail): LoanOfficerFormState {
  const profile = detail.profile || {};

  return {
    ...INITIAL_LOAN_OFFICER_FORM,
    email: detail.email || "",
    confirmEmail: detail.email || "",
    firstName: detail.firstName || "",
    lastName: detail.lastName || "",
    phone: detail.phone ? formatPhone(detail.phone) : "",
    allowedToLogin: detail.status === "ACTIVE",
    company: profile.company || "",
    address: profile.address || "",
    licenseNumber: profile.licenseNumber || "",
    ein: profile.ein || "",
    preferredComm: profile.preferredComm || "",
    website: profile.website || "",
    hasCompanyNmls: profile.hasCompanyNmls ?? false,
    companyNmls: profile.companyNmls || "",
    hasPersonalNmls: profile.hasPersonalNmls ?? false,
    personalNmls: profile.personalNmls || "",
    hasCompanyStateLicense: profile.hasCompanyStateLicense ?? false,
    companyStateLicenseStates: profile.companyStateLicenseStates || [],
    companyStateLicense: profile.companyStateLicense || "",
    hasPersonalStateLicense: profile.hasPersonalStateLicense ?? false,
    personalStateLicenseStates: profile.personalStateLicenseStates || [],
    personalStateLicense: profile.personalStateLicense || "",
    findersFee: profile.findersFee || "",
    statesAuthorized: profile.statesAuthorized || [],
    dre: profile.dre || "",
    branchIds: profile.branchIds || [],
    permissions: normalizeLoanOfficerPermissions(detail.permissions || []).filter(
      (key) => !LO_HIDDEN_PERMISSION_KEYS.includes(key),
    ),
    assignedCoBrokerIds:
      detail.assignedCoBrokerIds ||
      detail.assignedCoBrokers?.map((broker) => broker.id) ||
      [],
    avatarPreview: profile.avatarUrl || null,
  };
}

export function validateLoanOfficerForm(
  form: LoanOfficerFormState,
  options?: { isEdit?: boolean },
): LoanOfficerFormErrors {
  const errors: LoanOfficerFormErrors = {};
  const isEdit = options?.isEdit ?? false;

  if (!form.firstName.trim()) errors.firstName = "First name is required";
  if (!form.lastName.trim()) errors.lastName = "Last name is required";

  if (!form.email.trim()) errors.email = "Email is required";
  else if (!/^\S+@\S+\.\S+$/.test(form.email)) errors.email = "Invalid email format";

  if (!isEdit) {
    if (!form.confirmEmail.trim()) errors.confirmEmail = "Confirm email is required";
    else if (form.email.trim().toLowerCase() !== form.confirmEmail.trim().toLowerCase()) {
      errors.confirmEmail = "Emails do not match";
    }
  }

  const cleanPhone = form.phone.replace(/\D/g, "");
  if (!cleanPhone) errors.phone = "Phone is required";
  else if (cleanPhone.length < 10) errors.phone = "Enter a 10-digit phone number";

  if (!form.company.trim()) errors.company = "Company is required";

  if (form.allowedToLogin) {
    if (!isEdit) {
      if (!form.password) errors.password = "Password is required";
      else if (form.password.length < 8) errors.password = "Minimum 8 characters";
      if (!form.confirmPassword) errors.confirmPassword = "Confirm password is required";
      else if (form.password !== form.confirmPassword) {
        errors.confirmPassword = "Passwords do not match";
      }
    } else if (form.password) {
      if (form.password.length < 8) errors.password = "Minimum 8 characters";
      if (!form.confirmPassword) errors.confirmPassword = "Confirm password is required";
      else if (form.password !== form.confirmPassword) {
        errors.confirmPassword = "Passwords do not match";
      }
    }
  }

  const normalizedPermissions = normalizeLoanOfficerPermissions(form.permissions);
  if (!normalizedPermissions.length) {
    errors.permissions = "Select at least one permission";
  }

  return errors;
}

function normalizeWebsite(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function buildLoanOfficerFormData(form: LoanOfficerFormState): FormData {
  const formData = new FormData();

  const append = (key: string, value: string | boolean) => {
    formData.append(key, String(value));
  };

  append("email", form.email.trim().toLowerCase());
  append("confirmEmail", (form.confirmEmail || form.email).trim().toLowerCase());
  append("firstName", form.firstName.trim());
  append("lastName", form.lastName.trim());
  append("phone", form.phone.replace(/\D/g, ""));
  append("allowedToLogin", form.allowedToLogin);
  append("company", form.company.trim());
  append("address", form.address.trim());
  append("licenseNumber", form.licenseNumber.trim());
  append("ein", form.ein.trim());
  append("preferredComm", form.preferredComm);
  append("website", normalizeWebsite(form.website));
  append("agentType", "Loan Officer");
  append("hasCompanyNmls", form.hasCompanyNmls);
  append("companyNmls", form.companyNmls.trim());
  append("hasPersonalNmls", form.hasPersonalNmls);
  append("personalNmls", form.personalNmls.trim());
  append("hasCompanyStateLicense", form.hasCompanyStateLicense);
  append("companyStateLicense", form.companyStateLicense.trim());
  append("hasPersonalStateLicense", form.hasPersonalStateLicense);
  append("personalStateLicense", form.personalStateLicense.trim());
  append("findersFee", form.findersFee);
  append("dre", form.dre.trim());

  formData.append("statesAuthorized", JSON.stringify(form.statesAuthorized));
  formData.append(
    "companyStateLicenseStates",
    JSON.stringify(form.companyStateLicenseStates),
  );
  formData.append(
    "personalStateLicenseStates",
    JSON.stringify(form.personalStateLicenseStates),
  );
  formData.append("branchIds", JSON.stringify(form.branchIds));
  formData.append(
    "assignedCoBrokerIds",
    JSON.stringify(form.assignedCoBrokerIds),
  );

  const permissions = normalizeLoanOfficerPermissions(form.permissions).filter(
    (key) =>
      ALL_LO_PERMISSION_KEYS.includes(key) &&
      !LO_HIDDEN_PERMISSION_KEYS.includes(key),
  );

  formData.append("permissions", JSON.stringify(permissions));

  if (form.password) {
    append("password", form.password);
    append("confirmPassword", form.confirmPassword || form.password);
  }

  if (form.avatarFile) formData.append("avatar", form.avatarFile);
  if (form.w9File) formData.append("w9", form.w9File);

  return formData;
}

const BROKER_API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

function getBrokerAuthHeaders(): Record<string, string> {
  const token = sessionStorage.getItem("broker_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchLoanOfficerCoBrokers(): Promise<LoanOfficerCoBroker[]> {
  const res = await fetch(`${BROKER_API_BASE}/broker/users/co-brokers`, {
    headers: getBrokerAuthHeaders(),
  });
  const json = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(json.message || "Failed to load co-brokers");
  }

  return json.data || [];
}
