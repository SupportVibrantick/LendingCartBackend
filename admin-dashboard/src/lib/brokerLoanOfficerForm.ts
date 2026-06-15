import { CONTACT_US_STATES } from "./brokerContactForm";

export { CONTACT_US_STATES as LO_US_STATES };

export const LO_SERVICE_PROVIDERS = ["Internal", "External", "Partner"] as const;
export const LO_AGENT_TYPES = ["Loan Officer", "Senior Loan Officer", "Manager"] as const;
export const LO_PREFERRED_COMM_OPTIONS = [
  { value: "EMAIL", label: "Email" },
  { value: "PHONE", label: "Phone" },
] as const;

export type BrokerLoanOfficerFormState = {
  firstName: string;
  lastName: string;
  email: string;
  confirmEmail: string;
  password: string;
  confirmPassword: string;
  phone: string;
  licenseNumber: string;
  agentType: string;
  company: string;
  serviceProvider: string;
  tollFree: string;
  tollFreeExt: string;
  address: string;
  suite: string;
  city: string;
  state: string;
  zipCode: string;
  preferredComm: string;
  website: string;
  allowedToLogin: boolean;
  avatarFile: File | null;
  avatarPreview: string;
};

export type BrokerLoanOfficerFormErrors = Partial<
  Record<keyof BrokerLoanOfficerFormState, string>
>;

export const INITIAL_BROKER_LOAN_OFFICER_FORM: BrokerLoanOfficerFormState = {
  firstName: "",
  lastName: "",
  email: "",
  confirmEmail: "",
  password: "",
  confirmPassword: "",
  phone: "",
  licenseNumber: "",
  agentType: "Loan Officer",
  company: "",
  serviceProvider: "Internal",
  tollFree: "",
  tollFreeExt: "",
  address: "",
  suite: "",
  city: "",
  state: "",
  zipCode: "",
  preferredComm: "EMAIL",
  website: "",
  allowedToLogin: true,
  avatarFile: null,
  avatarPreview: "",
};

const PHONE_DIGIT_FIELDS = ["phone", "tollFree", "tollFreeExt", "zipCode"] as const;

export function formatLoPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function formatLoZip(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 9);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function cleanLoDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function normalizeLoWebsiteUrl(input: string) {
  if (!input.trim()) return "";

  let url = input.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `https://www.${url.replace(/^www\./i, "")}`;
  }

  try {
    const parsed = new URL(url);
    parsed.pathname = parsed.pathname.replace(/\/$/, "");
    return parsed.toString();
  } catch {
    return "";
  }
}

export function stripLoWebsitePrefix(value?: string | null) {
  if (!value) return "";
  return value.replace(/^https?:\/\/(www\.)?/i, "");
}

export function isLoDigitField(key: keyof BrokerLoanOfficerFormState) {
  return (PHONE_DIGIT_FIELDS as readonly string[]).includes(key);
}

export function validateBrokerLoanOfficerForm(
  form: BrokerLoanOfficerFormState,
  isEdit: boolean,
): BrokerLoanOfficerFormErrors {
  const errors: BrokerLoanOfficerFormErrors = {};
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}$/;
  const phoneRegex = /^(\+1\s?)?(\(?\d{3}\)?[\s-]?)\d{3}[\s-]?\d{4}$/;
  const zipRegex = /^\d{5}(-\d{4})?$/;
  const licenseRegex = /^[A-Za-z0-9-]{4,20}$/;

  const requiredFields: (keyof BrokerLoanOfficerFormState)[] = isEdit
    ? [
        "firstName",
        "lastName",
        "email",
        "confirmEmail",
        "phone",
        "company",
        "tollFree",
        "tollFreeExt",
        "suite",
        "serviceProvider",
        "address",
        "city",
        "state",
        "zipCode",
        "licenseNumber",
        "preferredComm",
        "website",
        "agentType",
      ]
    : [
        "firstName",
        "lastName",
        "email",
        "confirmEmail",
        "password",
        "confirmPassword",
        "phone",
        "company",
        "tollFree",
        "tollFreeExt",
        "suite",
        "serviceProvider",
        "address",
        "city",
        "state",
        "zipCode",
        "licenseNumber",
        "preferredComm",
        "website",
        "agentType",
      ];

  requiredFields.forEach((field) => {
    if (!form[field]?.toString().trim()) {
      errors[field] = "This field is required";
    }
  });

  if (form.email && !emailRegex.test(form.email)) {
    errors.email = "Enter a valid email address";
  }

  if (form.confirmEmail && !emailRegex.test(form.confirmEmail)) {
    errors.confirmEmail = "Enter a valid email address";
  }

  if (form.email !== form.confirmEmail) {
    errors.confirmEmail = "Emails do not match";
  }

  if (!isEdit) {
    if (
      form.password.length < 8 ||
      !/[A-Z]/.test(form.password) ||
      !/[0-9]/.test(form.password)
    ) {
      errors.password = "Password must be 8+ characters with 1 uppercase & 1 number";
    }

    if (form.password !== form.confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }
  }

  const formattedPhone = formatLoPhone(form.phone);
  if (form.phone && !phoneRegex.test(formattedPhone)) {
    errors.phone = "Enter valid US phone (e.g. 123-456-7890)";
  }

  const formattedZip = formatLoZip(form.zipCode);
  if (form.zipCode && !zipRegex.test(formattedZip)) {
    errors.zipCode = "Enter valid US ZIP (e.g. 12345 or 12345-6789)";
  }

  if (form.licenseNumber && !licenseRegex.test(form.licenseNumber)) {
    errors.licenseNumber = "License must be 4–20 alphanumeric characters";
  }

  if (form.website && !normalizeLoWebsiteUrl(form.website)) {
    errors.website = "Enter a valid website URL";
  }

  return errors;
}

export function buildBrokerLoanOfficerFormData(
  form: BrokerLoanOfficerFormState,
  isEdit: boolean,
) {
  const formData = new FormData();

  const appendField = (key: string, value: string | boolean) => {
    formData.append(key, String(value));
  };

  appendField("firstName", form.firstName.trim());
  appendField("lastName", form.lastName.trim());
  appendField("email", form.email.trim());
  appendField("confirmEmail", form.confirmEmail.trim());
  appendField("phone", cleanLoDigits(form.phone));
  appendField("licenseNumber", form.licenseNumber.trim());
  appendField("agentType", form.agentType);
  appendField("company", form.company.trim());
  appendField("serviceProvider", form.serviceProvider);
  appendField("tollFree", cleanLoDigits(form.tollFree));
  appendField("tollFreeExt", cleanLoDigits(form.tollFreeExt));
  appendField("address", form.address.trim());
  appendField("suite", form.suite.trim());
  appendField("city", form.city.trim());
  appendField("state", form.state);
  appendField("zipCode", cleanLoDigits(form.zipCode));
  appendField("preferredComm", form.preferredComm);
  appendField("allowedToLogin", form.allowedToLogin ? "true" : "false");

  const website = normalizeLoWebsiteUrl(form.website);
  if (website) {
    appendField("website", website);
  }

  if (!isEdit) {
    appendField("password", form.password);
    appendField("confirmPassword", form.confirmPassword);
  } else if (form.password.trim()) {
    appendField("password", form.password);
    appendField("confirmPassword", form.confirmPassword);
  }

  if (form.avatarFile) {
    formData.append("avatar", form.avatarFile);
  }

  return formData;
}
