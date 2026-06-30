import {
  FINDERS_FEE_OPTIONS,
  PREFERRED_COMMUNICATION,
} from "./coBrokerForm";
import {
  US_STATES,
  formatPhone,
  PERMISSIONS,
} from "../pages/UserManagement/loanOfficerShared";

export { US_STATES, formatPhone, FINDERS_FEE_OPTIONS, PREFERRED_COMMUNICATION };

export const STATE_OPTIONS = US_STATES.map((state) => ({
  value: state.code,
  text: state.name,
}));

export const ALL_PERMISSION_KEYS = PERMISSIONS.flatMap((group) =>
  group.items.map((item) => item.key),
);

export const PERMISSION_LEVEL_OPTIONS = [
  { value: "FULL_ACCESS", label: "Full Access" },
  { value: "LIMITED_ACCESS", label: "Limited Access" },
  { value: "VIEW_ONLY", label: "View Only" },
] as const;

export type PermissionLevel = (typeof PERMISSION_LEVEL_OPTIONS)[number]["value"];

export const PERMISSION_PRESETS: Record<PermissionLevel, string[]> = {
  FULL_ACCESS: [...ALL_PERMISSION_KEYS],
  LIMITED_ACCESS: [
    "VIEW_PIPELINE",
    "VIEW_APPLICATIONS",
    "CREATE_APPLICATION",
    "VIEW_CLIENTS",
    "MANAGE_CLIENTS",
    "VIEW_LENDERS",
    "VIEW_NOTIFICATIONS",
  ],
  VIEW_ONLY: [
    "VIEW_PIPELINE",
    "VIEW_APPLICATIONS",
    "VIEW_CLIENTS",
    "VIEW_LENDERS",
    "VIEW_STATS",
    "VIEW_NOTIFICATIONS",
  ],
};

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
  permissionLevel?: PermissionLevel | string;
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
  permissionLevel: PermissionLevel | "";
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
  permissionLevel: "",
  avatarFile: null,
  avatarPreview: null,
  w9File: null,
};

export function inferPermissionLevel(permissions: string[] = []): PermissionLevel | "" {
  if (!permissions.length) return "";

  const sorted = [...permissions].sort().join(",");
  for (const option of PERMISSION_LEVEL_OPTIONS) {
    const preset = [...PERMISSION_PRESETS[option.value]].sort().join(",");
    if (sorted === preset) return option.value;
  }

  if (permissions.length >= ALL_PERMISSION_KEYS.length) return "FULL_ACCESS";
  if (permissions.some((key) => key.startsWith("MANAGE_") || key === "CREATE_APPLICATION")) {
    return "LIMITED_ACCESS";
  }
  return "VIEW_ONLY";
}

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
    permissionLevel:
      (profile.permissionLevel as PermissionLevel) ||
      inferPermissionLevel(detail.permissions),
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

  if (!form.permissionLevel) {
    errors.permissionLevel = "Select a permission level";
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
  append("permissionLevel", form.permissionLevel);

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

  const permissions =
    form.permissionLevel && form.permissionLevel in PERMISSION_PRESETS
      ? PERMISSION_PRESETS[form.permissionLevel as PermissionLevel]
      : [];

  formData.append("permissions", JSON.stringify(permissions));

  if (form.password) {
    append("password", form.password);
    append("confirmPassword", form.confirmPassword || form.password);
  }

  if (form.avatarFile) formData.append("avatar", form.avatarFile);
  if (form.w9File) formData.append("w9", form.w9File);

  return formData;
}
