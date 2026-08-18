import { US_STATES, formatPhone } from "../pages/UserManagement/loanOfficerShared";

export { US_STATES, formatPhone };

export const PARTNER_TYPES = [
  "Mortgage Broker",
  "Licensed Loan Officer",
  "Independent Contractor",
  "Real Estate Broker/Agent",
  "Referral Partner",
];

export const AGENT_TYPES = ["Loan Officer", "Broker"];

export const FINDERS_FEE_OPTIONS = [
  "25%",
  "30%",
  "35%",
  "40%",
  "45%",
  "50%",
  "55%",
  "60%",
  "65%",
  "70%",
  "75%",
];

export const PREFERRED_COMMUNICATION = [
  "Email",
  "Phone",
  "Text Message",
  "WhatsApp",
];

export interface CoBrokerLoanOfficer {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  profileImage?: string | null;
}

export interface CoBrokerProfile {
  partnerType?: string;
  company?: string;
  allowedToLogin?: boolean;
  tollFree?: string;
  address?: string;
  agentType?: string;
  ssn?: string;
  linkedinUrl?: string;
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
  loanTypesOffered?: string[];
  findersFee?: string;
  ein?: string;
  preferredComm?: string;
  website?: string;
  statesAuthorized?: string[];
  employeeCount?: string;
  brokerStates?: string[];
  experience?: string;
  useSameContact?: boolean;
  contactFirstName?: string;
  contactLastName?: string;
  contactPhone?: string;
  contactEmail?: string;
  businessContact?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
  branchIds?: string[];
  logoUrl?: string | null;
  w9Url?: string | null;
}

export interface CoBrokerDetail {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: string;
  createdAt: string;
  updatedAt?: string;
  profile?: CoBrokerProfile;
  assignedLoanOfficers?: CoBrokerLoanOfficer[];
  assignedLoanOfficerIds?: string[];
}

export interface CoBrokerFormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  tollFree: string;
  password: string;
  confirmPassword: string;
  partnerType: string;
  company: string;
  allowedToLogin: boolean;
  address: string;
  agentType: string;
  ssn: string;
  linkedinUrl: string;
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
  loanTypesOffered: string[];
  findersFee: string;
  ein: string;
  preferredComm: string;
  website: string;
  statesAuthorized: string[];
  employeeCount: string;
  brokerStates: string[];
  experience: string;
  useSameContact: boolean;
  contactFirstName: string;
  contactLastName: string;
  contactPhone: string;
  contactEmail: string;
  branchIds: string[];
  assignedLoanOfficerIds: string[];
  logoFile: File | null;
  logoPreview: string | null;
  w9File: File | null;
}

export type CoBrokerFormErrors = Partial<Record<keyof CoBrokerFormState, string>>;

export const INITIAL_CO_BROKER_FORM: CoBrokerFormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  tollFree: "",
  password: "",
  confirmPassword: "",
  partnerType: "",
  company: "",
  allowedToLogin: false,
  address: "",
  agentType: "",
  ssn: "",
  linkedinUrl: "",
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
  loanTypesOffered: [],
  findersFee: "",
  ein: "",
  preferredComm: "",
  website: "",
  statesAuthorized: [],
  employeeCount: "",
  brokerStates: [],
  experience: "",
  useSameContact: true,
  contactFirstName: "",
  contactLastName: "",
  contactPhone: "",
  contactEmail: "",
  branchIds: [],
  assignedLoanOfficerIds: [],
  logoFile: null,
  logoPreview: null,
  w9File: null,
};

export function syncPrimaryContactFromBasic(
  form: CoBrokerFormState,
): Pick<
  CoBrokerFormState,
  "contactFirstName" | "contactLastName" | "contactPhone" | "contactEmail"
> {
  return {
    contactFirstName: form.firstName,
    contactLastName: form.lastName,
    contactPhone: form.phone,
    contactEmail: form.email,
  };
}

export function resolvePrimaryContactForSubmit(form: CoBrokerFormState) {
  if (form.useSameContact) {
    const synced = syncPrimaryContactFromBasic(form);
    return {
      ...form,
      ...synced,
    };
  }
  return form;
}

export function mapDetailToForm(detail: CoBrokerDetail): CoBrokerFormState {
  const profile = detail.profile || {};
  const useSameContact = profile.useSameContact ?? true;
  const businessContact = profile.businessContact;

  if (!useSameContact && businessContact) {
    return {
      ...INITIAL_CO_BROKER_FORM,
      firstName: businessContact.firstName || "",
      lastName: businessContact.lastName || "",
      email: businessContact.email || "",
      phone: businessContact.phone ? formatPhone(businessContact.phone) : "",
      contactFirstName: detail.firstName || profile.contactFirstName || "",
      contactLastName: detail.lastName || profile.contactLastName || "",
      contactPhone: detail.phone
        ? formatPhone(detail.phone)
        : profile.contactPhone
          ? formatPhone(profile.contactPhone)
          : "",
      contactEmail: detail.email || profile.contactEmail || "",
      useSameContact: false,
      tollFree: profile.tollFree ? formatPhone(profile.tollFree) : "",
      partnerType: profile.partnerType || "",
      company: profile.company || "",
      allowedToLogin: profile.allowedToLogin ?? false,
      address: profile.address || "",
      agentType: profile.agentType || "",
      ssn: profile.ssn || "",
      linkedinUrl: profile.linkedinUrl || "",
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
      loanTypesOffered: profile.loanTypesOffered || [],
      findersFee: profile.findersFee || "",
      ein: profile.ein || "",
      preferredComm: profile.preferredComm || "",
      website: profile.website || "",
      statesAuthorized: profile.statesAuthorized || [],
      employeeCount: profile.employeeCount || "",
      brokerStates: profile.brokerStates || [],
      experience: profile.experience || "",
      branchIds: profile.branchIds || [],
      assignedLoanOfficerIds:
        detail.assignedLoanOfficerIds ||
        detail.assignedLoanOfficers?.map((officer) => officer.id) ||
        [],
      logoPreview: profile.logoUrl || null,
    };
  }

  return {
    ...INITIAL_CO_BROKER_FORM,
    firstName: detail.firstName || "",
    lastName: detail.lastName || "",
    email: detail.email || "",
    phone: detail.phone ? formatPhone(detail.phone) : "",
    tollFree: profile.tollFree ? formatPhone(profile.tollFree) : "",
    partnerType: profile.partnerType || "",
    company: profile.company || "",
    allowedToLogin: profile.allowedToLogin ?? false,
    address: profile.address || "",
    agentType: profile.agentType || "",
    ssn: profile.ssn || "",
    linkedinUrl: profile.linkedinUrl || "",
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
    loanTypesOffered: profile.loanTypesOffered || [],
    findersFee: profile.findersFee || "",
    ein: profile.ein || "",
    preferredComm: profile.preferredComm || "",
    website: profile.website || "",
    statesAuthorized: profile.statesAuthorized || [],
    employeeCount: profile.employeeCount || "",
    brokerStates: profile.brokerStates || [],
    experience: profile.experience || "",
    useSameContact: true,
    contactFirstName: profile.contactFirstName || detail.firstName || "",
    contactLastName: profile.contactLastName || detail.lastName || "",
    contactPhone: profile.contactPhone
      ? formatPhone(profile.contactPhone)
      : detail.phone
        ? formatPhone(detail.phone)
        : "",
    contactEmail: profile.contactEmail || detail.email || "",
    branchIds: profile.branchIds || [],
    assignedLoanOfficerIds:
      detail.assignedLoanOfficerIds ||
      detail.assignedLoanOfficers?.map((officer) => officer.id) ||
      [],
    logoPreview: profile.logoUrl || null,
  };
}

export function validateCoBrokerForm(
  form: CoBrokerFormState,
  options?: { isEdit?: boolean },
): CoBrokerFormErrors {
  const errors: CoBrokerFormErrors = {};
  const isEdit = options?.isEdit ?? false;

  if (!form.company.trim()) errors.company = "Company is required";
  if (!form.agentType) errors.agentType = "Agent type is required";

  if (form.useSameContact) {
    if (!form.firstName.trim()) errors.firstName = "First name is required";
    else if (form.firstName.trim().length < 2) errors.firstName = "Minimum 2 characters";
    if (!form.lastName.trim()) errors.lastName = "Last name is required";
    if (!form.email.trim()) errors.email = "Email is required";
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) errors.email = "Invalid email format";

    const cleanPhone = form.phone.replace(/\D/g, "");
    if (!cleanPhone) errors.phone = "Phone is required";
    else if (cleanPhone.length < 10) errors.phone = "Enter 10-digit phone number";
  } else {
    if (!form.firstName.trim()) errors.firstName = "First name is required";
    if (!form.lastName.trim()) errors.lastName = "Last name is required";
    if (!form.email.trim()) errors.email = "Email is required";
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) errors.email = "Invalid email format";

    const cleanBusinessPhone = form.phone.replace(/\D/g, "");
    if (!cleanBusinessPhone) errors.phone = "Phone is required";
    else if (cleanBusinessPhone.length < 10) errors.phone = "Enter 10-digit phone number";

    if (!form.contactFirstName.trim()) errors.contactFirstName = "Contact first name is required";
    if (!form.contactLastName.trim()) errors.contactLastName = "Contact last name is required";
    if (!form.contactEmail.trim()) errors.contactEmail = "Contact email is required";
    else if (!/^\S+@\S+\.\S+$/.test(form.contactEmail)) {
      errors.contactEmail = "Invalid contact email format";
    }

    const cleanContactPhone = form.contactPhone.replace(/\D/g, "");
    if (!cleanContactPhone) errors.contactPhone = "Contact phone is required";
    else if (cleanContactPhone.length < 10) {
      errors.contactPhone = "Enter 10-digit contact phone number";
    }
  }

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

  return errors;
}

export function buildCoBrokerFormData(
  form: CoBrokerFormState,
): { body: Record<string, unknown>; files: { logo?: File; w9?: File } } {
  const resolvedForm = resolvePrimaryContactForSubmit(form);
  const body: Record<string, unknown> = {};

  const set = (key: string, value: string | boolean) => {
    body[key] = value;
  };

  set("firstName", resolvedForm.firstName.trim());
  set("lastName", resolvedForm.lastName.trim());
  set("email", resolvedForm.email.trim().toLowerCase());
  set("phone", resolvedForm.phone.replace(/\D/g, ""));
  set("tollFree", resolvedForm.tollFree.replace(/\D/g, ""));
  set("partnerType", resolvedForm.partnerType);
  set("company", resolvedForm.company.trim());
  set("allowedToLogin", resolvedForm.allowedToLogin);
  set("address", resolvedForm.address.trim());
  set("agentType", resolvedForm.agentType);
  set("ssn", resolvedForm.ssn.trim());
  set("linkedinUrl", resolvedForm.linkedinUrl.trim());
  set("hasCompanyNmls", resolvedForm.hasCompanyNmls);
  set("companyNmls", resolvedForm.companyNmls.trim());
  set("hasPersonalNmls", resolvedForm.hasPersonalNmls);
  set("personalNmls", resolvedForm.personalNmls.trim());
  set("hasCompanyStateLicense", resolvedForm.hasCompanyStateLicense);
  set("companyStateLicense", resolvedForm.companyStateLicense.trim());
  set("hasPersonalStateLicense", resolvedForm.hasPersonalStateLicense);
  set("personalStateLicense", resolvedForm.personalStateLicense.trim());
  set("findersFee", resolvedForm.findersFee);
  set("ein", resolvedForm.ein.trim());
  set("preferredComm", resolvedForm.preferredComm);
  set("website", resolvedForm.website.trim());
  set("employeeCount", resolvedForm.employeeCount.trim());
  set("experience", resolvedForm.experience.trim());
  set("useSameContact", resolvedForm.useSameContact);
  set("contactFirstName", resolvedForm.contactFirstName.trim());
  set("contactLastName", resolvedForm.contactLastName.trim());
  set("contactPhone", resolvedForm.contactPhone.replace(/\D/g, ""));
  set("contactEmail", resolvedForm.contactEmail.trim().toLowerCase());

  body.loanTypesOffered = resolvedForm.loanTypesOffered;
  body.statesAuthorized = resolvedForm.statesAuthorized;
  body.brokerStates = resolvedForm.brokerStates;
  body.companyStateLicenseStates = resolvedForm.companyStateLicenseStates;
  body.personalStateLicenseStates = resolvedForm.personalStateLicenseStates;
  body.branchIds = resolvedForm.branchIds;
  body.assignedLoanOfficerIds = resolvedForm.assignedLoanOfficerIds;

  if (resolvedForm.allowedToLogin && resolvedForm.password) {
    set("password", resolvedForm.password);
    set("confirmPassword", resolvedForm.confirmPassword || resolvedForm.password);
  }

  const files: { logo?: File; w9?: File } = {};
  if (resolvedForm.logoFile) files.logo = resolvedForm.logoFile;
  if (resolvedForm.w9File) files.w9 = resolvedForm.w9File;

  return { body, files };
}

export const STATE_OPTIONS = US_STATES.map((state) => ({
  value: state.code,
  text: state.name,
}));
