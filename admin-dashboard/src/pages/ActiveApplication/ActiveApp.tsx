import { GrCircleInformation } from "react-icons/gr";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";

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

type Broker = {
  id: string;
  name: string;
};

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
  const token = sessionStorage.getItem("admin_token");
  return { Authorization: `Bearer ${token}` };
}

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Invalid server response. Please login again.");
  }
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

/* ================= FIELD RENDERER ================= */

function RenderActiveField({
  field,
  onChange,
}: {
  field: ApiField;
  onChange: (key: string, value: unknown) => void;
}) {
  const uiType = mapApiFieldTypeToUI(field.fieldType);

  if (uiType === "radio") {
    return (
      <div className="space-y-2 border rounded-lg p-3 bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700">
        {field.options?.map((opt, i) => (
          <label key={i} className="flex items-center gap-2 text-xs">
            <input
              type="radio"
              name={field.fieldKey}
              value={opt}
              disabled
              onChange={() => onChange(field.fieldKey, opt)}
            />
            {opt}
          </label>
        ))}
      </div>
    );
  }

  if (uiType === "checkbox") {
    return (
      <div className="space-y-2 border rounded-lg p-3 bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700">
        {field.options?.map((opt, i) => (
          <label key={i} className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              disabled
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

  if (uiType === "range") {
    return (
      <div className="space-y-2 border rounded-lg p-3 bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700">
        <input
          type="range"
          disabled
          min={field.validation?.min ?? 0}
          max={field.validation?.max ?? 100}
          onChange={(e) => onChange(field.fieldKey, Number(e.target.value))}
          className="flex justify-between text-xs text-slate-500 dark:text-slate-400"
        />
        <div className="flex justify-between text-xs text-slate-500">
          <span>{field.validation?.min ?? 0}</span>
          <span>{field.validation?.max ?? 100}</span>
        </div>
      </div>
    );
  }

  if (uiType === "select") {
    return (
      <select
        disabled
        className="w-full rounded-lg border px-3 py-2 bg-white text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600 text-xs cursor-not-allowed"
        onChange={(e) => onChange(field.fieldKey, e.target.value)}
      >
        <option value="">{field.placeholder || "Select"}</option>
        {field.options?.map((o, i) => (
          <option key={i}>{o}</option>
        ))}
      </select>
    );
  }

  if (uiType === "textarea") {
    return (
      <textarea
        rows={4}
        disabled
        placeholder={field.placeholder || ""}
        className="w-full rounded-lg border px-3 py-2 text-xs bg-white text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600 cursor-not-allowed"
        onChange={(e) => onChange(field.fieldKey, e.target.value)}
      />
    );
  }

  if (uiType === "file") {
    return (
      <input
        type="file"
        disabled
        className="w-full rounded-lg border px-3 py-2 text-xs bg-white text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600 cursor-not-allowed"
        onChange={(e) => onChange(field.fieldKey, e.target.files?.[0] || null)}
      />
    );
  }

  return (
    <input
      type={uiType}
      disabled
      placeholder={field.placeholder || ""}
      className="w-full rounded-lg border px-3 py-2 text-xs cursor-not-allowed bg-white text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
      onChange={(e) => onChange(field.fieldKey, e.target.value)}
    />
  );
}

/* ================= PAGE ================= */

export default function ActiveApplication() {
  const navigate = useNavigate();
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [brokerOrgId, setBrokerOrgId] = useState("");
  const [data, setData] = useState<ActiveApplicationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeProductId, setActiveProductId] = useState("");
  const [productLoading, setProductLoading] = useState(false);
  const [, setValues] = useState<Record<string, unknown>>({});

  const handleChange = (key: string, value: unknown) => {
    setValues((p) => ({ ...p, [key]: value }));
  };

  const fetchBrokers = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/brokers/read`, {
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      const list = Array.isArray(json) ? json : json.data || [];
      setBrokers(
        list.map((o: { id: string; name?: string }) => ({
          id: String(o.id),
          name: o.name ?? "",
        }))
      );
    } catch {
      toast.error("Failed to load brokers");
    }
  };

  const loadActiveApplication = async (selectedBrokerId: string) => {
    if (!selectedBrokerId) return;

    try {
      setLoading(true);
      const res = await fetch(
        `${API_BASE}/admin/applications/active?brokerOrgId=${selectedBrokerId}`,
        { headers: getAuthHeaders() }
      );
      const json = await safeJson(res);

      if (!res.ok || json.success !== true) {
        throw new Error(json.message || "Failed to load active application");
      }

      setData(json.data);
      setActiveProductId(json.data.products[0]?.productId ?? "");
    } catch (err: unknown) {
      setData(null);
      const message =
        err instanceof Error ? err.message : "Failed to load active application";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBrokers();
  }, []);

  const product = data?.products.find((p) => p.productId === activeProductId);

  const hasNoFields =
    (product?.sections?.every((s) => s.fields.length === 0) ?? true) &&
    (product?.unsectionedFields?.length ?? 0) === 0;

  return (
    <div className="p-6 min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex gap-2 items-center">
            <h1 className="text-2xl font-bold text-[#13538A] dark:text-indigo-400">
              {data ? `Application: ${data.applicationName}` : "Active Application"}
            </h1>

            {data && (
              <div className="relative group inline-flex">
                <GrCircleInformation className="w-5 h-5 text-blue-600 cursor-pointer" />
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full w-64 bg-slate-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                  This application is currently active and visible across all
                  platforms.
                  <div className="absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 bg-slate-900 rotate-45" />
                </div>
              </div>
            )}
          </div>

          <p className="text-sm text-slate-500 mt-1">
            View loan application fields and requirements by loan product.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate("/create-application")}
          className="inline-flex items-center gap-2 bg-[#13538A] text-white px-4 py-2 text-sm font-medium rounded-xl hover:bg-[#2e87d4] transition-colors"
        >
          <Plus size={16} />
          Create Application
        </button>
      </div>

      <div className="mb-6 max-w-sm">
        <label className="block text-sm font-medium mb-1">Select Broker</label>
        <select
          value={brokerOrgId}
          onChange={(e) => {
            const selected = e.target.value;
            setBrokerOrgId(selected);
            setActiveProductId("");
            setData(null);

            if (selected) {
              loadActiveApplication(selected);
            }
          }}
          className="w-full rounded-lg border px-3 py-2 text-sm bg-white text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
        >
          <option value="">Select Broker</option>
          {brokers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600" />
        </div>
      )}

      {!loading && brokerOrgId && !data && (
        <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed rounded-xl border-slate-300 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            No Active Application
          </h3>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            This broker has no active application. Create and activate one from
            Application Builder.
          </p>
        </div>
      )}

      {data && (
        <>
          <div className="mb-6 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300">
            <strong>Reference View:</strong> This page displays the application
            fields configured for the selected loan product. All fields are
            read-only and cannot be edited from this screen.
          </div>

          <select
            className="mb-6 border rounded px-3 py-2 text-xs bg-white text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
            value={activeProductId}
            onChange={(e) => {
              const value = e.target.value;
              setProductLoading(true);
              setTimeout(() => {
                setActiveProductId(value);
                setProductLoading(false);
              }, 200);
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
            <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed rounded-xl border-amber-300 bg-amber-50 dark:border-amber-600 dark:bg-amber-900/20">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
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
              <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                No Fields Configured
              </h3>
              <p className="mt-2 max-w-md text-center text-xs text-amber-700 dark:text-amber-400">
                There are no form fields available for this product. Configure
                fields from the Application Builder.
              </p>
            </div>
          )}

          {productLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600" />
            </div>
          ) : (
            <form className="space-y-8 p-6 rounded-xl border bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-700">
              {STATIC_SECTIONS.map((section) => (
                <div key={section.name}>
                  <h3 className="text-sm font-semibold mb-3 text-slate-800 dark:text-slate-200">
                    {section.name}
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {section.fields.map((fieldKey) => (
                      <div key={fieldKey}>
                        <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">
                          {fieldKey}
                        </label>
                        <input
                          type="text"
                          disabled
                          className="w-full rounded-lg border px-3 py-2 text-xs bg-white text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600 cursor-not-allowed"
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
                        <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">
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
                    {product?.unsectionedFields.map((f) => (
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
            </form>
          )}
        </>
      )}
    </div>
  );
}
