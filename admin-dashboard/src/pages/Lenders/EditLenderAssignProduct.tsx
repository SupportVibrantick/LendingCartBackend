import { useEffect, useState, FormEvent } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { useParams } from "react-router-dom";

/* ================= API ================= */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "http://localhost:3001",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("admin_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/* ================= TYPES ================= */
// interface Lender {
//   id: string;
//   name: string;
// }

interface LoanProduct {
  id: string;
  name: string;
  code: string;
}

interface MessageState {
  type: "success" | "error";
  text: string;
}

export type BusinessType = {
  label: string;
  value: string;
};

interface Errors {
  lenderOrgId?: string;
  loanTypes?: string;
  minLoanAmount?: string;
  maxLoanAmount?: string;
  minTermMonths?: string;
  maxTermMonths?: string;
  equipmentTypes?: string;
  minLTV?: string;
  maxLTV?: string;
  minCreditScore?: string;
  minimumExperience?: string;
  typeOfBusiness?: string;
  interestRateRange?: string;
  states?: string;
}

interface FormState {
  lenderOrgId: string;
  loanProductCode: string;

  loanTypes: string[];
  typeOfBusiness: string[];
  states: string[];

  equipmentTypes: string[];
  otherEquipmentExplanation?: string;

  minLoanAmount: string;
  maxLoanAmount: string;
  minTermMonths: string;
  maxTermMonths: string;

  minLTV: string;
  maxLTV: string;
  minCreditScore: string;
  interestRateRange: string;
  minimumExperience: string;

  notes: string;
  isActive: boolean;
}
export const BUSINESS_TYPES: BusinessType[] = [
  { label: "Hospitality", value: "HOSPITALITY" },
  { label: "Hotels & Motels", value: "HOTELS_MOTELS" },
  { label: "Resorts", value: "RESORTS" },
  { label: "Restaurants & Bars", value: "RESTAURANTS_BARS" },
  { label: "Cafes & Coffee Shops", value: "CAFES_COFFEE" },
  { label: "Quick Service Restaurants (QSR)", value: "QSR" },
  { label: "Catering Services", value: "CATERING" },
  { label: "Nightclubs & Entertainment Venues", value: "NIGHTCLUBS" },

  { label: "Healthcare Practices", value: "HEALTHCARE_PRACTICES" },
  { label: "Medical Clinics", value: "MEDICAL_CLINICS" },
  { label: "Dental Practices", value: "DENTAL_PRACTICES" },
  { label: "Veterinary Clinics", value: "VETERINARY_CLINICS" },
  { label: "Pharmacies", value: "PHARMACIES" },
  { label: "Assisted Living", value: "ASSISTED_LIVING" },
  { label: "Nursing Homes", value: "NURSING_HOMES" },
  { label: "Senior Housing", value: "SENIOR_HOUSING" },
  { label: "Mental Health Facilities", value: "MENTAL_HEALTH" },
  { label: "Rehabilitation Centers", value: "REHAB_CENTERS" },

  { label: "Retail", value: "RETAIL" },
  { label: "Retail & E-commerce", value: "RETAIL_ECOMMERCE" },
  { label: "E-commerce", value: "ECOMMERCE" },
  { label: "Grocery Stores", value: "GROCERY_STORES" },
  { label: "Convenience Stores", value: "CONVENIENCE_STORES" },
  { label: "Gas Stations", value: "GAS_STATIONS" },
  { label: "Liquor Stores", value: "LIQUOR_STORES" },
  { label: "Apparel & Fashion Retail", value: "APPAREL_FASHION" },
  { label: "Electronics Retail", value: "ELECTRONICS_RETAIL" },
  { label: "Furniture & Home Goods", value: "FURNITURE_HOME" },
  { label: "Specialty Retail", value: "SPECIALTY_RETAIL" },

  { label: "Office / Professional Services", value: "PROFESSIONAL_SERVICES" },
  { label: "Law Firms", value: "LAW_FIRMS" },
  { label: "Accounting Firms", value: "ACCOUNTING_FIRMS" },
  { label: "Consulting Firms", value: "CONSULTING_FIRMS" },
  { label: "Insurance Agencies", value: "INSURANCE_AGENCIES" },
  { label: "Real Estate Offices", value: "REAL_ESTATE_OFFICES" },
  { label: "Marketing & Advertising Agencies", value: "MARKETING_AGENCIES" },
  { label: "IT Services", value: "IT_SERVICES" },
  { label: "Software & SaaS Companies", value: "SOFTWARE_SAAS" },

  { label: "Industrial", value: "INDUSTRIAL" },
  { label: "Manufacturing", value: "MANUFACTURING" },
  { label: "Light Manufacturing", value: "LIGHT_MANUFACTURING" },
  { label: "Heavy Manufacturing", value: "HEAVY_MANUFACTURING" },
  { label: "Factories", value: "FACTORIES" },
  { label: "Processing Plants", value: "PROCESSING_PLANTS" },
  { label: "Assembly Facilities", value: "ASSEMBLY_FACILITIES" },

  { label: "Transportation", value: "TRANSPORTATION" },
  { label: "Logistics", value: "LOGISTICS" },
  { label: "Warehousing", value: "WAREHOUSING" },
  { label: "Distribution Centers", value: "DISTRIBUTION_CENTERS" },
  { label: "Trucking Companies", value: "TRUCKING" },
  { label: "Freight & Shipping", value: "FREIGHT_SHIPPING" },
  { label: "Last-Mile Delivery", value: "LAST_MILE_DELIVERY" },

  { label: "Construction", value: "CONSTRUCTION" },
  { label: "General Contractors", value: "GENERAL_CONTRACTORS" },
  { label: "Residential Construction", value: "RESIDENTIAL_CONSTRUCTION" },
  { label: "Commercial Construction", value: "COMMERCIAL_CONSTRUCTION" },

  { label: "Self-Storage", value: "SELF_STORAGE" },
  { label: "Automotive", value: "AUTOMOTIVE" },
  { label: "Auto Dealerships", value: "AUTO_DEALERSHIPS" },
  { label: "Auto Repair & Service Centers", value: "AUTO_REPAIR" },
  { label: "Car Washes", value: "CAR_WASHES" },

  { label: "Property Management", value: "PROPERTY_MANAGEMENT" },
  { label: "Multi-Family Operators", value: "MULTIFAMILY_OPERATORS" },
  { label: "Single-Family Rental Operators", value: "SFR_OPERATORS" },

  { label: "Financial Services", value: "FINANCIAL_SERVICES" },
  { label: "Private Equity Firms", value: "PRIVATE_EQUITY" },
  { label: "Investment Firms", value: "INVESTMENT_FIRMS" },
  { label: "Mortgage Brokers", value: "MORTGAGE_BROKERS" },
  { label: "Lending Companies", value: "LENDING_COMPANIES" },

  { label: "Franchise Businesses", value: "FRANCHISE_BUSINESSES" },
  { label: "Multi-Unit Operators", value: "MULTI_UNIT_OPERATORS" },

  { label: "Agriculture & Farming", value: "AGRICULTURE" },
  { label: "Food Processing", value: "FOOD_PROCESSING" },
  { label: "Cold Storage", value: "COLD_STORAGE" },

  { label: "Education Services", value: "EDUCATION_SERVICES" },
  { label: "Training Centers", value: "TRAINING_CENTERS" },
  { label: "Childcare & Daycare", value: "DAYCARE" },

  { label: "Entertainment", value: "ENTERTAINMENT" },
  { label: "Event Venues", value: "EVENT_VENUES" },
  { label: "Gyms & Fitness Centers", value: "GYMS_FITNESS" },

  { label: "Energy & Utilities", value: "ENERGY_UTILITIES" },
  { label: "Renewable Energy", value: "RENEWABLE_ENERGY" },
  { label: "Data Centers", value: "DATA_CENTERS" },
  { label: "Other (Please Explain)", value: "OTHER" },
];

export const EQUIPMENT_TYPES = [
  {
    label:
      "Industrial Equipment (CNC machines, lathes, milling machines, generators, air compressors, welding equipment)",
    value: "INDUSTRIAL_EQUIPMENT",
  },
  {
    label:
      "Transportation Equipment (Tractor trucks, trailers, dump trucks, delivery vans, fleet vehicles)",
    value: "TRANSPORTATION_EQUIPMENT",
  },
  {
    label:
      "Construction & Agriculture Equipment (Cranes, excavators, forklifts, loaders, tractors, agricultural machinery)",
    value: "CONSTRUCTION_AGRICULTURE_EQUIPMENT",
  },
  {
    label:
      "Medical Equipment (Imaging machines MRI/CT, dental chairs, hospital beds)",
    value: "MEDICAL_EQUIPMENT",
  },
  {
    label:
      "IT & Office Equipment (Computers, servers, printers, phone systems)",
    value: "IT_OFFICE_EQUIPMENT",
  },
  {
    label:
      "Restaurant/Food Service Equipment (Commercial ovens, refrigerators, food processing machinery)",
    value: "RESTAURANT_EQUIPMENT",
  },
  {
    label: "Landscaping & Snow Removal Equipment (Chippers, plows, mowers)",
    value: "LANDSCAPING_EQUIPMENT",
  },
  {
    label:
      "Specialty Equipment (Car washes, vending machines, sanitation equipment)",
    value: "SPECIALTY_EQUIPMENT",
  },
  {
    label: "Other (Please Explain)",
    value: "OTHER",
  },
];

interface Props {
  lenderId?: string;
  onClose?: () => void;
  onSuccess?: () => void;
}

/* ================= COMPONENT ================= */
export default function EditLenderAssignProduct({
  lenderId,
  onSuccess,
  onClose,
}: Props) {
  const [loanProducts, setLoanProducts] = useState<LoanProduct[]>([]);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState<MessageState | null>(null);
  const { lenderId: paramId } = useParams<{ lenderId: string }>();
  const [productIds, setProductIds] = useState<Record<string, string>>({});
  const [initialLoanTypes, setInitialLoanTypes] = useState<string[]>([]);
  const [form, setForm] = useState<FormState>({
    lenderOrgId: lenderId || paramId || "",
    loanProductCode: "",
    loanTypes: [],
    typeOfBusiness: [],
    states: [],

    equipmentTypes: [],
    otherEquipmentExplanation: "",

    minLoanAmount: "",
    maxLoanAmount: "",
    minTermMonths: "",
    maxTermMonths: "",

    minLTV: "",
    maxLTV: "",
    minCreditScore: "",
    interestRateRange: "",
    minimumExperience: "",

    notes: "",
    isActive: true,
  });

  const US_STATES = [
    { code: "AL" },
    { code: "AK" },
    { code: "AZ" },
    { code: "AR" },
    { code: "CA" },
    { code: "CO" },
    { code: "CT" },
    { code: "DE" },
    { code: "FL" },
    { code: "GA" },
    { code: "HI" },
    { code: "ID" },
    { code: "IL" },
    { code: "IN" },
    { code: "IA" },
    { code: "KS" },
    { code: "KY" },
    { code: "LA" },
    { code: "ME" },
    { code: "MD" },
    { code: "MA" },
    { code: "MI" },
    { code: "MN" },
    { code: "MS" },
    { code: "MO" },
    { code: "MT" },
    { code: "NE" },
    { code: "NV" },
    { code: "NH" },
    { code: "NJ" },
    { code: "NM" },
    { code: "NY" },
    { code: "NC" },
    { code: "ND" },
    { code: "OH" },
    { code: "OK" },
    { code: "OR" },
    { code: "PA" },
    { code: "RI" },
    { code: "SC" },
    { code: "SD" },
    { code: "TN" },
    { code: "TX" },
    { code: "UT" },
    { code: "VT" },
    { code: "VA" },
    { code: "WA" },
    { code: "WV" },
    { code: "WI" },
    { code: "WY" },
  ];

  const MINIMUM_EXPERIENCE = [
    "0-1 projects",
    "2-3 projects",
    "4-5 projects",
    "6-10 projects",
    "10+ projects",
    "No minimum",
  ];

  //   /* ================= LOAD DATA ================= */
  //   useEffect(() => {
  //     async function loadProducts() {
  //       try {
  //         const productsRes = await api.get("/admin/loan-products/list");
  //         setLoanProducts(productsRes.data?.data ?? []);
  //       } catch {
  //         setMessage({ type: "error", text: "Failed to load products" });
  //       }
  //     }

  //     loadProducts();
  //   }, []);

  useEffect(() => {
    async function loadData() {
      try {
        const orgId = lenderId || paramId;

        if (!orgId) return;

        // loan products list
        const productsRes = await api.get("/admin/loan-products/list");
        setLoanProducts(productsRes.data?.data ?? []);

        // lender assigned products
        const res = await api.get(`/admin/lender-products/lender/${orgId}`);

        const lenderProducts = res.data?.data || [];

        if (!lenderProducts.length) return;
        const ids: Record<string, string> = {};

        lenderProducts.forEach((p: any) => {
          ids[p.loanProductCode] = p.loanProductId;
        });

        setProductIds(ids);

        const first = lenderProducts[0];

        const equipmentProduct = lenderProducts.find(
          (p: any) => p.loanProductCode === "EQUIPMENT_FINANCE",
        );

        const loanCodes = lenderProducts.map((p: any) => p.loanProductCode);

        setInitialLoanTypes(loanCodes);

        setForm((prev) => ({
          ...prev,

          lenderOrgId: orgId,

          // ✔ checked loan product checkboxes
          loanTypes: loanCodes,

          // ✔ business types checkboxes
          typeOfBusiness: first.businessTypes || [],

          // ✔ states checkboxes
          states: first.statesSupported || [],

          /* ===== EQUIPMENT TYPES ===== */
          equipmentTypes: equipmentProduct?.equipmentTypes
            ? equipmentProduct.equipmentTypes.split(",")
            : [],

          otherEquipmentExplanation:
            equipmentProduct?.otherEquipmentExplanation || "",

          minLoanAmount: first.minLoanAmount?.toString() || "",
          maxLoanAmount: first.maxLoanAmount?.toString() || "",

          minTermMonths: first.minTermMonths?.toString() || "",
          maxTermMonths: first.maxTermMonths?.toString() || "",

          minLTV: first.minLtvPercent?.toString() || "",
          maxLTV: first.maxLtvPercent?.toString() || "",

          minCreditScore: first.minCreditScore?.toString() || "",

          minimumExperience: first.minExperience || "",
          interestRateRange: first.interestRateRange || "",

          isActive: first.isActive ?? true,
        }));
      } catch (err) {
        console.error(err);
        toast.error("Failed to load lender products");
      }
    }

    loadData();
  }, [lenderId, paramId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  /* ================= VALIDATION ================= */
  function validate(): Errors {
    const e: Errors = {};

    // REQUIRED
    if (!form.lenderOrgId) {
      e.lenderOrgId = "Lender is required";
    }

    if (form.loanTypes.length === 0) {
      e.loanTypes = "Select at least one loan type";
    }

    if (!form.interestRateRange) {
      e.interestRateRange = "Interest rate range required";
    }

    // ================= AMOUNTS =================
    const minLoan = Number(form.minLoanAmount);
    const maxLoan = Number(form.maxLoanAmount);

    if (!form.minLoanAmount) {
      e.minLoanAmount = "Minimum amount required";
    } else if (isNaN(minLoan)) {
      e.minLoanAmount = "Invalid number";
    }

    if (!form.maxLoanAmount) {
      e.maxLoanAmount = "Maximum amount required";
    } else if (isNaN(maxLoan)) {
      e.maxLoanAmount = "Invalid number";
    }

    if (!e.minLoanAmount && !e.maxLoanAmount && minLoan > maxLoan) {
      e.maxLoanAmount = "Max must be greater than Min";
    }

    // ================= BUSINESS TYPE =================
    if (isBusinessTypeRequired && form.typeOfBusiness.length === 0) {
      e.typeOfBusiness = "Select at least one business type";
    }

    // ================= EQUIPMENT =================
    if (isEquipmentFinanceSelected) {
      if (form.equipmentTypes.length === 0) {
        e.equipmentTypes = "Select at least one equipment type";
      }

      if (
        form.equipmentTypes.includes("OTHER") &&
        !form.otherEquipmentExplanation
      ) {
        e.loanTypes = "Please explain other equipment type";
      }
    }

    // ================= TERMS =================
    const minTerm = Number(form.minTermMonths);
    const maxTerm = Number(form.maxTermMonths);

    if (!form.minTermMonths) e.minTermMonths = "Required";
    if (!form.maxTermMonths) e.maxTermMonths = "Required";

    if (!e.minTermMonths && !e.maxTermMonths && minTerm > maxTerm) {
      e.maxTermMonths = "Max term must be ≥ Min term";
    }

    // ================= LTV =================
    const minLTV = Number(form.minLTV);
    const maxLTV = Number(form.maxLTV);

    if (!form.minLTV) {
      e.minLTV = "Min LTV is required";
    } else if (isNaN(minLTV) || minLTV < 0 || minLTV > 100) {
      e.minLTV = "Must be between 0–100";
    }

    if (!form.maxLTV) {
      e.maxLTV = "Max LTV is required";
    } else if (isNaN(maxLTV) || maxLTV < 0 || maxLTV > 100) {
      e.maxLTV = "Must be between 0–100";
    }

    if (!e.minLTV && !e.maxLTV && minLTV > maxLTV) {
      e.maxLTV = "Max LTV must be ≥ Min LTV";
    }

    // ================= CREDIT SCORE =================
    const credit = Number(form.minCreditScore);

    if (!form.minCreditScore) {
      e.minCreditScore = "Minimum credit score required";
    } else if (isNaN(credit) || credit < 300 || credit > 900) {
      e.minCreditScore = "Score must be between 300–900";
    }

    // ================= STATES =================
    if (form.states.length === 0) {
      e.states = "Select at least one state";
    }

    // ================= EXPERIENCE =================
    if (!form.minimumExperience) {
      e.minimumExperience = "Select minimum experience";
    }

    return e;
  }

  /* ================= SUBMIT ================= */
  async function handleUpdate(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setMessage(null);

    const v = validate();

    if (Object.keys(v).length) {
      setErrors(v);
      return;
    }

    setSubmitting(true);

    try {
      const updates = initialLoanTypes.map(async (code) => {
        const productId = productIds[code];

        if (!productId) return;

        const isSelected = form.loanTypes.includes(code);

        const payload = {
          businessTypes: form.typeOfBusiness.length
            ? form.typeOfBusiness
            : undefined,

          equipmentTypes:
            code === "EQUIPMENT_FINANCE" ? form.equipmentTypes : undefined,

          otherEquipmentExplanation:
            code === "EQUIPMENT_FINANCE"
              ? form.otherEquipmentExplanation
              : undefined,

          minLoanAmount: Number(form.minLoanAmount),

          maxLoanAmount: Number(form.maxLoanAmount),

          minTermMonths: Number(form.minTermMonths),

          maxTermMonths: Number(form.maxTermMonths),

          minLtvPercent: Number(form.minLTV),

          maxLtvPercent: Number(form.maxLTV),

          minCreditScore: Number(form.minCreditScore),

          minExperience: form.minimumExperience,

          interestRateRange: form.interestRateRange,

          statesSupported: form.states,

          isActive: isSelected,
        };

        return api.patch(`/admin/loan-products/update/${productId}`, payload);
      });

      await Promise.all(updates);

      // toast.success("Products updated successfully");

      onSuccess?.();
      onClose?.();
    } catch (err) {
      toast.error("Failed to update products");
    } finally {
      setSubmitting(false);
    }
  }

  const isEquipmentFinanceSelected =
    form.loanTypes.includes("EQUIPMENT_FINANCE");

  const isBusinessTypeRequired =
    form.loanTypes.includes("SBA_7A") ||
    form.loanTypes.includes("ACCOUNTS_RECEIVABLE");

  useEffect(() => {
    if (!isBusinessTypeRequired) {
      setForm((f) => ({
        ...f,
        typeOfBusiness: [],
      }));
    }
  }, [isBusinessTypeRequired]);

  useEffect(() => {
    if (lenderId || paramId) {
      setForm((prev) => ({
        ...prev,
        lenderOrgId: lenderId || paramId || "",
      }));
    }
  }, [lenderId, paramId]);

  function formatLoanLabel(text: string) {
    return text
      .replace(/_/g, " ") // SBA_7A → SBA 7A
      .toUpperCase() // everything → CAPS
      .trim();
  }

  function handleNumberChange(field: keyof FormState, value: string) {
    if (value === "" || Number(value) >= 0) {
      setForm((prev) => ({
        ...prev,
        [field]: value,
      }));
    }
  }

  /* ================= UI ================= */
  return (
    <div className="max-w-4xl mx-auto p-6 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-xl shadow border border-slate-200 dark:border-slate-700">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold">Assign Product to Lender</h2>
        {/* <button
          type="button"
          onClick={onClose}
          className="px-3 py-1 rounded border text-sm"
        >
          Close
        </button> */}
      </div>

      {message && (
        <div
          className={`p-3 mb-4 rounded ${
            message.type === "error"
              ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300"
              : "bg-green-50 text-green-700 dark:bg-emerald-500/10 dark:text-emerald-300"
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleUpdate} className="space-y-4">
        {/* <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">Lender</label>
            <select
              value={form.lenderOrgId}
              onChange={(e) =>
                setForm({ ...form, lenderOrgId: e.target.value })
              }
              className="mt-1 block w-full rounded-md border p-2 bg-white text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
            >
              <option value="">Select lender</option>
              {lenders.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            {errors.lenderOrgId && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {errors.lenderOrgId}
              </p>
            )}
          </div>
        </div> */}

        {/* ================= LOAN TYPES ================= */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Loan Types (select multiple)
          </label>

          {/* CHECKBOX LIST */}
          <div
            className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2
                  bg-white dark:bg-slate-800
                  border-slate-300 dark:border-slate-600"
          >
            {loanProducts.map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-2 text-sm cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={form.loanTypes.includes(p.code)}
                  onChange={() =>
                    setForm((prev) => {
                      const set = new Set(prev.loanTypes);
                      set.has(p.code) ? set.delete(p.code) : set.add(p.code);
                      return { ...prev, loanTypes: Array.from(set) };
                    })
                  }
                  className="accent-emerald-600 "
                />
                {formatLoanLabel(p.name)}
              </label>
            ))}
          </div>
          {errors.loanTypes && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
              {errors.loanTypes}
            </p>
          )}

          {/* SELECTED CHIPS */}
          {form.loanTypes.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {form.loanTypes.map((t) => (
                <span
                  key={t}
                  className="px-3 py-1 rounded-full uppercase text-xs font-medium
                     bg-emerald-100 text-emerald-700
                     dark:bg-emerald-500/15 dark:text-emerald-300"
                >
                  {formatLoanLabel(t)}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ================= TYPE OF BUSINESS ================= */}
        {isBusinessTypeRequired && (
          <div>
            <label className="block text-sm font-medium mb-2">
              Type of Business (select multiple)
            </label>

            <div
              className="border rounded-lg p-3 max-h-52 overflow-y-auto space-y-2
      bg-white dark:bg-slate-800
      border-slate-300 dark:border-slate-600"
            >
              {BUSINESS_TYPES.map((bt) => (
                <label
                  key={bt.value}
                  className="flex items-start gap-2 text-sm cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={form.typeOfBusiness.includes(bt.value)}
                    onChange={() =>
                      setForm((prev) => {
                        const set = new Set(prev.typeOfBusiness);
                        set.has(bt.value)
                          ? set.delete(bt.value)
                          : set.add(bt.value);
                        return { ...prev, typeOfBusiness: Array.from(set) };
                      })
                    }
                    className="accent-indigo-600 mt-1"
                  />
                  {bt.label}
                </label>
              ))}
            </div>

            {/* OTHER BUSINESS EXPLANATION */}
            {form.typeOfBusiness.includes("OTHER") && (
              <div className="mt-3">
                <input
                  type="text"
                  placeholder="Please explain other business type"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full rounded-md border p-2
            bg-white text-slate-900 border-slate-300
            dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
                />
              </div>
            )}

            {errors.typeOfBusiness && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                {errors.typeOfBusiness}
              </p>
            )}
          </div>
        )}

        {isEquipmentFinanceSelected && (
          <div>
            <label className="block text-sm font-medium mb-2">
              Equipment Types (select multiple)
            </label>

            <div
              className="border rounded-lg p-3 space-y-2
      bg-white dark:bg-slate-800
      border-slate-300 dark:border-slate-600"
            >
              {EQUIPMENT_TYPES.map((eq) => (
                <label
                  key={eq.value}
                  className="flex items-start gap-2 text-sm cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={form.equipmentTypes.includes(eq.value)}
                    onChange={() =>
                      setForm((prev) => {
                        const set = new Set(prev.equipmentTypes);
                        set.has(eq.value)
                          ? set.delete(eq.value)
                          : set.add(eq.value);
                        return { ...prev, equipmentTypes: Array.from(set) };
                      })
                    }
                    className="accent-indigo-600 mt-1"
                  />
                  {eq.label}
                </label>
              ))}
            </div>

            {/* OTHER EXPLANATION */}
            {form.equipmentTypes.includes("OTHER") && (
              <div className="mt-3">
                <input
                  type="text"
                  placeholder="Please explain other equipment"
                  value={form.otherEquipmentExplanation}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      otherEquipmentExplanation: e.target.value,
                    })
                  }
                  className="w-full rounded-md border p-2
            bg-white text-slate-900 border-slate-300
            dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
                />
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium">Min Loan Amount</label>
            <input
              type="number"
              min="0"
              onWheel={(e) => (e.target as HTMLInputElement).blur()}
              value={form.minLoanAmount}
              onChange={(e) =>
                handleNumberChange("minLoanAmount", e.target.value)
              }
              className="mt-1 block w-full rounded-md border p-2 bg-white text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
              placeholder="e.g. 50000"
            />
            {errors.minLoanAmount && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {errors.minLoanAmount}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium">Max Loan Amount</label>
            <input
              type="number"
              min="0"
              onWheel={(e) => (e.target as HTMLInputElement).blur()}
              value={form.maxLoanAmount}
              onChange={(e) =>
                handleNumberChange("maxLoanAmount", e.target.value)
              }
              className="mt-1 block w-full rounded-md border p-2 bg-white text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
              placeholder="e.g. 2500000"
            />
            {errors.maxLoanAmount && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {errors.maxLoanAmount}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium">
              Min Term (months)
            </label>
            <input
              type="number"
              min="0"
              onWheel={(e) => (e.target as HTMLInputElement).blur()}
              value={form.minTermMonths}
              onChange={(e) =>
                handleNumberChange("minTermMonths", e.target.value)
              }
              className="mt-1 block w-full rounded-md border p-2 bg-white text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
            />
            {errors.minTermMonths && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {errors.minTermMonths}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium">
              Max Term (months)
            </label>
            <input
              type="number"
              min="0"
              onWheel={(e) => (e.target as HTMLInputElement).blur()}
              value={form.maxTermMonths}
              onChange={(e) =>
                handleNumberChange("maxTermMonths", e.target.value)
              }
              className="mt-1 block w-full rounded-md border p-2 bg-white text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
            />
            {errors.maxTermMonths && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {errors.maxTermMonths}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium">Min LTV %</label>
            <input
              type="number"
              min="0"
              onWheel={(e) => (e.target as HTMLInputElement).blur()}
              value={form.minLTV}
              onChange={(e) => handleNumberChange("minLTV", e.target.value)}
              className="mt-1 block w-full rounded-md border p-2
      bg-white text-slate-900 border-slate-300
      dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
            />
            {errors.minLTV && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {errors.minLTV}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium">Max LTV %</label>
            <input
              type="number"
              min="0"
              onWheel={(e) => (e.target as HTMLInputElement).blur()}
              value={form.maxLTV}
              onChange={(e) => handleNumberChange("maxLTV", e.target.value)}
              className="mt-1 block w-full rounded-md border p-2
      bg-white text-slate-900 border-slate-300
      dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
            />
            {errors.maxLTV && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {errors.maxLTV}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium">
              Min Credit Score
            </label>
            <input
              type="number"
              min="0"
              onWheel={(e) => (e.target as HTMLInputElement).blur()}
              value={form.minCreditScore}
              onChange={(e) =>
                handleNumberChange("minCreditScore", e.target.value)
              }
              className="mt-1 block w-full rounded-md border p-2 bg-white text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
            />
            {errors.minCreditScore && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {errors.minCreditScore}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium">
              Minimum Experience
            </label>

            <select
              value={form.minimumExperience}
              onChange={(e) =>
                setForm({ ...form, minimumExperience: e.target.value })
              }
              className="mt-1 block w-full rounded-md border p-2 text-sm
      bg-white text-slate-900 border-slate-300
      dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
            >
              <option value="">Select minimum experience</option>

              {MINIMUM_EXPERIENCE.map((exp) => (
                <option key={exp} value={exp}>
                  {exp}
                </option>
              ))}
            </select>
            {errors.minimumExperience && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {errors.minimumExperience}
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">
            Interest Rate Range
          </label>
          <input
            type="text"
            value={form.interestRateRange}
            placeholder="eg. 6.5% - 8.5%"
            onChange={(e) =>
              setForm({ ...form, interestRateRange: e.target.value })
            }
            className="mt-1 block w-full rounded-md border p-2 bg-white text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
          />
          {errors.interestRateRange && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {errors.interestRateRange}
            </p>
          )}
        </div>
        {/* ================= STATES ================= */}
        <div>
          <label className="block text-sm font-medium mb-2">States</label>

          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  states: US_STATES.map((s) => s.code),
                }))
              }
              className="px-3 py-1 text-sm rounded border
                 bg-white border-slate-300
                 dark:bg-slate-800 dark:border-slate-600"
            >
              Select All States
            </button>

            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, states: [] }))}
              className="px-3 py-1 text-sm rounded border
                 bg-white border-slate-300
                 dark:bg-slate-800 dark:border-slate-600"
            >
              Clear All
            </button>
          </div>

          <div
            className="border rounded-lg p-3 max-h-52 overflow-y-auto
               bg-white dark:bg-slate-800
               border-slate-300 dark:border-slate-600"
          >
            <div className="grid grid-cols-4 gap-3 text-sm">
              {US_STATES.map((s) => (
                <label key={s.code} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.states.includes(s.code)}
                    onChange={() =>
                      setForm((prev) => {
                        const set = new Set(prev.states);
                        set.has(s.code) ? set.delete(s.code) : set.add(s.code);
                        return { ...prev, states: Array.from(set) };
                      })
                    }
                    className="accent-indigo-600"
                  />
                  {s.code}
                </label>
              ))}
            </div>
          </div>
          {errors.states && (
            <p className="text-xs text-red-600 mt-2">{errors.states}</p>
          )}

          <p className="text-xs text-slate-500 mt-2">
            {form.states.length} states selected
          </p>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={submitting}
            className="ml-auto px-4 py-2 rounded bg-indigo-600 text-white disabled:opacity-50"
          >
            {submitting ? "Assigning..." : "Save Assign Product"}
          </button>
        </div>
      </form>
    </div>
  );
}
