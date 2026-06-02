import { GrCircleInformation } from "react-icons/gr";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

/* ================= ENUM ================= */

export enum ApiFieldType {
  TEXT = "TEXT",
  TEXTAREA = "TEXTAREA",
  NUMBER = "NUMBER",
  EMAIL = "EMAIL",
  DATE = "DATE",

  SELECT = "SELECT",
  RADIO = "RADIO",
  CHECKBOX = "CHECKBOX",
  CHECKBOX_GROUP = "CHECKBOX_GROUP",

  FILE = "FILE",
  RANGE = "RANGE",
}

/* ================= TYPES ================= */

type ApiField = {
  id: string;
  label: string;
  fieldKey: string;
  fieldType: ApiFieldType;
  placeholder?: string | null;
  isRequired: boolean;
  options?: string[] | null;
  validation?: {
    min?: number;
    max?: number;
  };
};

type ApiSection = {
  id: string;
  name: string;
  sortOrder?: number;
  fields: ApiField[];
};

type Product = {
  productId: string;
  loanProductCode: string;
  sections: ApiSection[];
  unsectionedFields: ApiField[];
};

type ActiveApplicationResponse = {
  applicationId: string;
  applicationName: string;
  products: Product[];
};

/* ================= HELPERS ================= */

function getAuthHeaders() {
  const token = sessionStorage.getItem("broker_token");
  return { Authorization: `Bearer ${token}` };
}

function mapApiFieldTypeToUI(type: ApiFieldType) {
  switch (type) {
    case ApiFieldType.TEXT:
      return "text";
    case ApiFieldType.EMAIL:
      return "email";
    case ApiFieldType.NUMBER:
      return "number";
    case ApiFieldType.TEXTAREA:
      return "textarea";
    case ApiFieldType.SELECT:
      return "select";
    case ApiFieldType.RADIO:
      return "radio";
    case ApiFieldType.CHECKBOX:
    case ApiFieldType.CHECKBOX_GROUP:
      return "checkbox";
    case ApiFieldType.FILE:
      return "file";
    case ApiFieldType.DATE:
      return "date";
    case ApiFieldType.RANGE:
      return "range";
    default:
      return "text";
  }
}

const STATIC_SECTIONS = [
  {
    name: "Loan Request",
    fields: [
      "Purpose of the Loan",
      "Amount of Loan Request",
      "Expected Interest Rate %",
      "Current Market Value (As-Is)",
      "Purchase Price $",
      "Purchase Date",
      "After Repair Value (ARV)",
      "Total Assets",
      "Total Liabilities",
      "Property Type",
      "Sub Property Type",
      "Recourse",
      "Property Address",
      "Property City",
      "Property State",
      "Property Zip",
    ],
  },

  {
    name: "Borrower Info",
    fields: [
      "Borrower Name",
      "Company Name",
      "Phone",
      "Email",
      "Employer",
      "Date of Birth",
      "SSN",
      "Credit Score",
      "Address",
      "Mailing Address",
    ],
  },

  {
    name: "Entity Info",
    fields: [
      "Entity Legal Name",
      "Entity Type",
      "DBA",
      "Formation Date",
      "Years In Business",
    ],
  },

  {
    name: "Loan Term & Income",
    fields: [
      "Loan Term",
      "Monthly Rent",
      "Gross Revenue Actual",
      "Gross Revenue Proforma",
      "NOI Actual",
      "NOI Proforma",
      "Annual Taxes",
      "Flood Zone",
      "Insurance Premium",
      "HOA Dues",
    ],
  },
];

/* ================= FIELD RENDERER ================= */

function RenderActiveField({
  field,
  onChange,
}: {
  field: ApiField;
  onChange: (key: string, value: any) => void;
}) {
  const uiType = mapApiFieldTypeToUI(field.fieldType);

  /* RADIO */
  if (uiType === "radio") {
    return (
      <div
        className="space-y-2 border rounded-lg p-3
                bg-slate-50 border-slate-200
                dark:bg-slate-800 dark:border-slate-700"
      >
        {field.options?.map((opt, i) => (
          <label key={i} className="flex items-center gap-2 text-xs">
            <input
              type="radio"
              name={field.fieldKey}
              value={opt}
              onChange={() => onChange(field.fieldKey, opt)}
            />
            {opt}
          </label>
        ))}
      </div>
    );
  }

  /* CHECKBOX GROUP */
  if (uiType === "checkbox") {
    return (
      <div
        className="space-y-2 border rounded-lg p-3
                bg-slate-50 border-slate-200
                dark:bg-slate-800 dark:border-slate-700"
      >
        {field.options?.map((opt, i) => (
          <label key={i} className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              onChange={(e) =>
                onChange(`${field.fieldKey}.${opt}`, e.target.checked)
              }
            />
            {opt}
          </label>
        ))}
      </div>
    );
  }

  /* RANGE */
  if (uiType === "range") {
    return (
      <div
        className="space-y-2 border rounded-lg p-3
                bg-slate-50 border-slate-200
                dark:bg-slate-800 dark:border-slate-700"
      >
        <input
          type="range"
          min={field.validation?.min ?? 0}
          max={field.validation?.max ?? 100}
          onChange={(e) => onChange(field.fieldKey, Number(e.target.value))}
          className="flex justify-between text-xs
                text-slate-500 dark:text-slate-400"
        />
        <div className="flex justify-between text-xs text-slate-500">
          <span>{field.validation?.min ?? 0}</span>
          <span>{field.validation?.max ?? 100}</span>
        </div>
      </div>
    );
  }

  /* SELECT */
  if (uiType === "select") {
    return (
      <select
        className="w-full rounded-lg border px-3 py-2
           bg-white text-slate-900 border-slate-300
           dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600 text-xs"
        onChange={(e) => onChange(field.fieldKey, e.target.value)}
      >
        <option value="">{field.placeholder || "Select"}</option>
        {field.options?.map((o, i) => (
          <option key={i}>{o}</option>
        ))}
      </select>
    );
  }

  /* TEXTAREA */
  if (uiType === "textarea") {
    return (
      <textarea
        rows={4}
        disabled
        placeholder={field.placeholder || ""}
        className="w-full rounded-lg border px-3 py-2 text-xs
           bg-white text-slate-900 border-slate-300
           dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600 cursor-not-allowed"
        onChange={(e) => onChange(field.fieldKey, e.target.value)}
      />
    );
  }

  /* FILE */
  if (uiType === "file") {
    return (
      <input
        type="file"
        disabled
        className="w-full rounded-lg border px-3 py-2 text-xs
           bg-white text-slate-900 border-slate-300
           dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600 cursor-not-allowed"
        onChange={(e) => onChange(field.fieldKey, e.target.files?.[0] || null)}
      />
    );
  }

  /* BASIC INPUT */
  return (
    <input
      type={uiType}
      placeholder={field.placeholder || ""}
      className="w-full rounded-lg border px-3 py-2 text-xs cursor-not-allowed"
      onChange={(e) => onChange(field.fieldKey, e.target.value)}
      disabled
    />
  );
}

const PRODUCT_LABELS: Record<string, string> = {
  FIX_AND_FLIP_LOAN_1_TO_4_UNITS: "FIX & FLIP",
  DSCR_LOAN_1_TO_4_UNITS: "DSCR",
  CONSTRUCTION_LOAN_1_TO_4_UNITS: "CONSTRUCTION",
  BRIDGE_LOAN_1_TO_4_UNITS: "BRIDGE LOAN",

  SBA_7A: "SBA 7A",
  SBA_7A_WORKING_CAPITAL: "SBA 7A WORKING CAPITAL",
  SBA_7A_BUSINESS_ACQUISITION: "SBA 7A BUSINESS ACQUISITION",
  SBA_7A_EQUIPMENT_PURCHASE: "SBA 7A EQUIPMENT PURCHASE",
  SBA_7A_REAL_ESTATE: "SBA 7A REAL ESTATE",
  SBA_504_REAL_ESTATE_AND_EQUIPMENT: "SBA 504 Real Estate",

  USDA_BI: "USDA B&I",

  CMBS: "CMBS",
  AGENCY_LOAN_MULTIFAMILY: "AGENCY MULTIFAMILY",
  CRE_PERMANENT_LOAN: "CRE PERMANENT",
  RENTAL_PORTFOLIO: "RENTAL PORTFOLIO",
  MEZZANINE_FINANCE: "MEZZANINE FINANCE",
  PREFERRED_EQUITY: "PREFERRED EQUITY",

  PURCHASE_ORDER_FINANCE: "PURCHASE ORDER FINANCE",
  EQUIPMENT_FINANCE: "EQUIPMENT FINANCE",
  ACCOUNTS_PAYABLE_FINANCE: "ACCOUNTS PAYABLE FINANCE",
  ACCOUNTS_RECEIVABLE: "ACCOUNTS RECEIVABLE",
  INVOICE_FACTORING: "INVOICE FACTORING",
};

/* ================= PAGE ================= */

export default function ActiveApplication() {
  const [data, setData] = useState<ActiveApplicationResponse | null>(null);
  const [activeProductId, setActiveProductId] = useState("");
  const [values, setValues] = useState<Record<string, any>>({});
  const [productLoading, setProductLoading] = useState(false);

  const handleChange = (key: string, value: any) => {
    setValues(values);
    setValues((p) => ({ ...p, [key]: value }));
  };

  const load = async () => {
    try {
      const res = await fetch(`${API_BASE}/broker/applications/active`, {
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setData(json.data);
      setActiveProductId(json.data.products[0]?.productId);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const product = data?.products.find((p) => p.productId === activeProductId);

  const hasNoFields =
    (product?.sections?.every((s) => s.fields.length === 0) ?? true) &&
    (product?.unsectionedFields?.length ?? 0) === 0;

  if (!data) return null;

  return (
    <div className="p-6 min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-xl font-bold text-[#2C92D5]">
          {data.applicationName}
        </h1>

        {/* Visibility Icon */}
        <div className="relative group inline-flex">
          <GrCircleInformation className="w-5 h-5 text-blue-600 dark:text-blue-400 cursor-pointer" />

          {/* Tooltip */}
          <div
            className="
    absolute left-1/2 -translate-x-1/2 bottom-full
    w-64
    bg-slate-900 dark:bg-slate-800
    text-white text-xs
    px-3 py-2 rounded-lg
    shadow-lg
    opacity-0 group-hover:opacity-100
    transition-opacity duration-200
    pointer-events-none
    z-[999999999999999]
  "
          >
            This application is currently active and visible across all
            platforms.
            {/* Arrow */}
            <div className="absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 bg-slate-900 dark:bg-slate-800 rotate-45"></div>
          </div>
        </div>
      </div>
      <select
        className="mb-6 border rounded px-3 py-2 text-xs
             bg-white text-slate-900 border-slate-300
             dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
        value={activeProductId}
        onChange={(e) => {
          const value = e.target.value;

          setProductLoading(true);

          setTimeout(() => {
            setActiveProductId(value);
            setProductLoading(false);
          }, 300);
        }}
      >
        {data.products.map((p) => (
          <option key={p.productId} value={p.productId}>
            {PRODUCT_LABELS[p.loanProductCode] ??
              p.loanProductCode.replace(/_/g, " ")}
          </option>
        ))}
      </select>

      {hasNoFields && (
        <div
          className="flex flex-col items-center justify-center py-16
                  border-2 border-dashed rounded-xl
                  border-amber-300 bg-amber-50
                  dark:border-amber-600 dark:bg-amber-900/20"
        >
          {/* ICON */}
          <div
            className="mb-4 flex h-14 w-14 items-center justify-center
                    rounded-full bg-amber-100 text-amber-600
                    dark:bg-amber-500/20 dark:text-amber-400"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-7 w-7"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.6}
                d="M12 9v4m0 4h.01M10.29 3.86l-7.4 12.8A1.5 1.5 0 004.17 19h15.66a1.5 1.5 0 001.28-2.34l-7.4-12.8a1.5 1.5 0 00-2.42 0z"
              />
            </svg>
          </div>

          {/* TITLE */}
          <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            No Fields Configured
          </h3>

          {/* MESSAGE */}
          <p
            className="mt-2 max-w-md text-center text-xs
                  text-amber-700 dark:text-amber-400"
          >
            There are no form fields available for this product. Please contact
            the administrator or configure fields from the Application Builder.
          </p>
        </div>
      )}
      {productLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600" />
        </div>
      ) : (
        <form
          className="space-y-8 p-6 rounded-xl border
                 bg-white border-slate-200
                 dark:bg-slate-900 dark:border-slate-700"
        >
          {STATIC_SECTIONS.map((section) => (
            <div key={section.name}>
              <h3 className="text-sm font-semibold mb-3 text-slate-800 dark:text-slate-200">
                {section.name}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {section.fields.map((fieldKey) => (
                  <div key={fieldKey}>
                    <label
                      className="block text-sm font-medium mb-2
            text-slate-700 dark:text-slate-300"
                    >
                      {fieldKey}
                    </label>

                    <input
                      type="text"
                      disabled
                      className="w-full rounded-lg border px-3 py-2 text-xs
            bg-white text-slate-900 border-slate-300
            dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600 cursor-not-allowed"
                      onChange={(e) => handleChange(fieldKey, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
          {product?.sections.map((section) => (
            <div key={section.id}>
              <h3 className="text-sm font-semibold mb-3 text-slate-800 dark:text-slate-200">
                {section.name}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {section.fields.map((f) => (
                  <div key={f.id}>
                    <label
                      className="block text-sm font-medium mb-2
                  text-slate-700 dark:text-slate-300"
                    >
                      {f.label}
                      {f.isRequired && (
                        <span className="text-red-500 ml-1">*</span>
                      )}
                    </label>

                    <RenderActiveField field={f} onChange={handleChange} />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {(product?.unsectionedFields?.length ?? 0) > 0 && (
            <div>
              <h3 className="font-semibold mb-4">Other Information</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {product &&
                  (product.unsectionedFields ?? []).map((f) => (
                    <div key={f.id}>
                      <label className="block text-sm font-medium mb-2">
                        {f.label}
                        {f.isRequired && (
                          <span className="text-red-500 ml-1">*</span>
                        )}
                      </label>

                      <RenderActiveField field={f} onChange={handleChange} />
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* <button
          type="button"
          onClick={() => console.log(values)}
          className="bg-blue-600 text-white px-6 py-2 rounded"
        >
          Submit Application
        </button> */}
        </form>
      )}
    </div>
  );
}
