import type { BrokerContactInput } from "./brokerDetailApi";

export const CONTACT_ENTITY_TYPES = [
  "Sole Proprietorship",
  "Limited Partnership",
  "General Partnership",
  "LLC",
  "Corp",
  "S-Corp",
  "Self Employed-1099 Contractor",
  "501 (c)(3) Nonprofit",
  "501 (c)(19) Veterans Org",
  "Tribal Business",
  "Trust",
  "Joint Venture",
  "Estate",
  "Other",
  "Member",
  "Partner",
  "Shareholder",
  "Managing Member",
] as const;

export const CONTACT_US_STATES = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
] as const;

export const INITIAL_BROKER_CONTACT_FORM: BrokerContactInput = {
  contactType: "LENDER",
  firstName: "",
  lastName: "",
  email: "",
  companyName: "",
  website: "",
  phone: "",
  tollFree: "",
  cellNumber: "",
  faxNumber: "",
  address: "",
  city: "",
  state: "",
  zipCode: "",
  stateOfFormation: "",
  entityType: "",
  description: "",
};

export type BrokerContactFormErrors = Partial<Record<keyof BrokerContactInput, string>>;

const PHONE_FIELDS = ["phone", "cellNumber", "tollFree", "faxNumber"] as const;

export function formatContactPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;

  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function formatContactPhoneValue(value?: string | null) {
  if (!value) return "";
  return formatContactPhone(String(value));
}

export function formatContactZipCode(value: string) {
  return value.replace(/\D/g, "").slice(0, 5);
}

export function isContactPhoneField(key: keyof BrokerContactInput): key is (typeof PHONE_FIELDS)[number] {
  return (PHONE_FIELDS as readonly string[]).includes(key);
}

function validateContactField(name: keyof BrokerContactInput, value: string) {
  if (name !== "description" && !value.trim()) {
    return "This field is required";
  }

  switch (name) {
    case "email":
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return "Invalid email address";
      }
      break;
    case "phone":
    case "cellNumber":
    case "tollFree":
    case "faxNumber":
      if (!/^\d{3}-\d{3}-\d{4}$/.test(value)) {
        return "Phone must be 10 digits";
      }
      break;
    case "zipCode":
      if (!/^\d{5}$/.test(value)) {
        return "ZIP code must be 5 digits";
      }
      break;
    default:
      return "";
  }

  return "";
}

export function validateBrokerContactForm(form: BrokerContactInput): BrokerContactFormErrors {
  const errors: BrokerContactFormErrors = {};

  (Object.keys(form) as (keyof BrokerContactInput)[]).forEach((key) => {
    const value = String(form[key] ?? "");
    const error = validateContactField(key, value);
    if (error) {
      errors[key] = error;
    }
  });

  return errors;
}
