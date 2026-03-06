import { useState } from "react";
import toast from "react-hot-toast";

type Props = {
  onClose: () => void;
};

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

export enum ContactType {
  ACCOUNTANT = "ACCOUNTANT",
  APPRAISER = "APPRAISER",
  ASSIGNOR = "ASSIGNOR",
  ATTORNEY = "ATTORNEY",
  AUDITOR = "AUDITOR",
  BROKER = "BROKER",
  BROKER_PROCESSOR = "BROKER_PROCESSOR",
  CLOSING_CONTACT = "CLOSING_CONTACT",
  CONTRACTOR = "CONTRACTOR",
  COUNSELOR = "COUNSELOR",
  CUSTODIAN = "CUSTODIAN",
  ESCROW = "ESCROW",
  ESCROW_ASSISTANT = "ESCROW_ASSISTANT",
  FINANCIAL_ADVISOR = "FINANCIAL_ADVISOR",
  GENERAL_CONTRACTOR = "GENERAL_CONTRACTOR",
  HOA = "HOA",
  INSPECTOR = "INSPECTOR",
  INSURANCE_FLOOD = "INSURANCE_FLOOD",
  INSURANCE_GENERAL = "INSURANCE_GENERAL",
  INSURANCE_HOA = "INSURANCE_HOA",
  INSURANCE_PROPERTY = "INSURANCE_PROPERTY",
  INVESTOR = "INVESTOR",
  LENDER = "LENDER",
  LENDER_ATTORNEY = "LENDER_ATTORNEY",
  LOAN_PREPARER = "LOAN_PREPARER",
  OTHER_UNSPECIFIED = "OTHER_UNSPECIFIED",
  OWNER = "OWNER",
  PARALEGAL = "PARALEGAL",
  PROPERTY_MANAGER = "PROPERTY_MANAGER",
  PROSPECT = "PROSPECT",
  RE_AGENT_BUYER = "RE_AGENT_BUYER",
  RE_AGENT_SELLER = "RE_AGENT_SELLER",
  REALTOR_BPO = "REALTOR_BPO",
  SECONDARY_NOTE_BUYER = "SECONDARY_NOTE_BUYER",
  SELLER_ATTORNEY = "SELLER_ATTORNEY",
  SERVICER = "SERVICER",
  TITLE_REP = "TITLE_REP",
  TRUSTEE = "TRUSTEE",
  OTHER = "OTHER",
}

const ENTITY_TYPES = [
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
];

const US_STATES = [
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
];

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 10);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;

  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const validateField = (name: string, value: string) => {
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
};

export default function CreateContactModal({ onClose }: Props) {
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    contactType: ContactType.LENDER,
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
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const contactTypeOptions = Object.values(ContactType);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;

    let newValue = value;

    if (["phone", "cellNumber", "tollFree", "faxNumber"].includes(name)) {
      newValue = formatPhone(value);
    }

    if (name === "zipCode") {
      newValue = value.replace(/\D/g, "").slice(0, 5);
    }

    setForm((prev) => ({
      ...prev,
      [name]: newValue,
    }));

    const error = validateField(name, newValue);

    setErrors((prev) => ({
      ...prev,
      [name]: error || "",
    }));
  };

  const createContact = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};

    Object.entries(form).forEach(([key, value]) => {
      const error = validateField(key, value as string);
      if (error) newErrors[key] = error;
    });

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) return;

    setLoading(true);

    try {
      const token = sessionStorage.getItem("broker_token");
      const res = await fetch(`${API_BASE}/broker/contacts/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error("Failed to create contact");

      toast.success("Contact created successfully");
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[999999]">
      <div className="bg-white w-[750px] rounded-xl shadow-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between mb-6">
          <h2 className="text-lg font-semibold">Create Contact</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-red-500 text-lg"
          >
            ✕
          </button>
        </div>

        <form onSubmit={createContact} className="grid grid-cols-2 gap-4">
          <Select
            label="Contact Type"
            name="contactType"
            value={form.contactType}
            onChange={handleChange}
            error={errors.contactType}
            options={contactTypeOptions.map((t) => ({
              value: t,
              label: t.replace(/_/g, " "),
            }))}
          />

          <Input
            label="First Name"
            name="firstName"
            value={form.firstName}
            onChange={handleChange}
            placeholder="Enter first name"
            error={errors.firstName}
          />

          <Input
            label="Last Name"
            name="lastName"
            value={form.lastName}
            onChange={handleChange}
            placeholder="Enter last name"
            error={errors.lastName}
          />

          <Input
            label="Email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="Enter Email"
            error={errors.email}
          />
          <Input
            label="Company Name"
            name="companyName"
            value={form.companyName}
            onChange={handleChange}
            placeholder="Enter company name"
            error={errors.company}
          />

          <Input
            label="Website"
            name="website"
            value={form.website}
            onChange={handleChange}
            placeholder="Enter website"
            error={errors.website}
          />

          <Input
            label="Phone"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            placeholder="123-456-7890"
            error={errors.phone}
          />
          <Input
            label="Cell Number"
            name="cellNumber"
            value={form.cellNumber}
            onChange={handleChange}
            placeholder="Enter cell number"
            error={errors.cellNumber}
          />

          <Input
            label="Toll Free"
            name="tollFree"
            value={form.tollFree}
            onChange={handleChange}
            placeholder="Enter toll free"
            error={errors.tollFree}
          />
          <Input
            label="Fax Number"
            name="faxNumber"
            value={form.faxNumber}
            onChange={handleChange}
            placeholder="Enter fax number"
            error={errors.faxNumber}
          />

          <Input
            label="Address"
            name="address"
            value={form.address}
            onChange={handleChange}
            placeholder="Enter address"
            error={errors.address}
          />

          <Input
            label="City"
            name="city"
            value={form.city}
            onChange={handleChange}
            placeholder="Enter city"
            error={errors.city}
          />

          <Select
            label="State"
            name="state"
            value={form.state}
            onChange={handleChange}
            error={errors.state}
            options={US_STATES.map((s) => ({
              value: s.code,
              label: s.name,
            }))}
          />

          <Input
            label="Zip Code"
            name="zipCode"
            value={form.zipCode}
            onChange={handleChange}
            placeholder="Enter zip code"
            error={errors.zipCode}
          />

          <Select
            label="State Of Formation"
            name="stateOfFormation"
            value={form.stateOfFormation}
            onChange={handleChange}
            error={errors.stateOfFormation}
            options={US_STATES.map((s) => ({
              value: s.code,
              label: s.name,
            }))}
          />

          <Select
            label="Entity Type"
            name="entityType"
            value={form.entityType}
            onChange={handleChange}
            error={errors.entityType}
            options={ENTITY_TYPES.map((e) => ({
              value: e,
              label: e,
            }))}
          />

          <div className="col-span-2 flex flex-col gap-1">
            <label className="text-sm font-medium">Description</label>
            <textarea
              rows={6}
              name="description"
              value={form.description}
              onChange={handleChange}
              className="text-xs border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg"
            >
              {loading ? "Creating..." : "Create Contact"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type InputProps = {
  label: string;
  name: string;
  value: string;
  placeholder?: string;
  error?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

function Input({
  label,
  name,
  value,
  onChange,
  placeholder,
  error,
}: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium">{label}</label>

      <input
        name={name}
        value={value}
        placeholder={placeholder}
        onChange={onChange}
        className={`text-xs border rounded-lg px-3 py-2 outline-none
        ${error ? "border-red-500 focus:ring-red-400" : "focus:ring-indigo-500"}`}
      />

      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}

type SelectProps = {
  label: string;
  name: string;
  value: string;
  options: { value: string; label: string }[];
  error?: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
};

function Select({ label, name, value, options, onChange, error }: SelectProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium">{label}</label>

      <select
        name={name}
        value={value}
        onChange={onChange}
        className={`text-xs border rounded-lg px-3 py-2 outline-none
        ${error ? "border-red-500 focus:ring-red-400" : "focus:ring-indigo-500"}`}
      >
        <option value="">Select</option>

        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
