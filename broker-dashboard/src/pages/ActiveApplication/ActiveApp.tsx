import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

/* ================= TYPES ================= */

type Validation = {
  min?: number;
  max?: number;
};

type Field = {
  fieldId: string;
  fieldKey: string;
  label: string;
  placeholder?: string | null;
  type: "TEXT" | "NUMBER" | "EMAIL" | "FILE" | "TEXTAREA" | "SELECT";
  required: boolean;
  options: string[] | null;
  validation?: Validation | null;
  sortOrder?: number | null;
};

type Product = {
  productId: string;
  loanProductCode: string;
  fields: Field[];
};

type ActiveApplicationResponse = {
  applicationId: string;
  applicationName: string;
  products: Product[];
};

/* ================= HELPERS ================= */

function getAuthHeaders() {
  const token = sessionStorage.getItem("broker_token");
  return {
    Authorization: `Bearer ${token}`,
  };
}

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    console.error("RAW RESPONSE:", text);
    throw new Error("Invalid server response. Please login again.");
  }
}

/* ================= PAGE ================= */

const ActiveApplication: React.FC = () => {
  const [data, setData] = useState<ActiveApplicationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeProductId, setActiveProductId] = useState<string>("");

  const [formValues, setFormValues] = useState<Record<string, any>>({});

  /* ================= LOAD ACTIVE APPLICATION ================= */

  const loadActiveApplication = async () => {
    try {
      setLoading(true);

      const res = await fetch(`${API_BASE}/broker/applications/active`, {
        headers: getAuthHeaders(),
      });

      const json = await safeJson(res);

      if (!res.ok || json.success !== true) {
        throw new Error(json.message || "Failed to load active application");
      }

      const app = json.data as ActiveApplicationResponse;

      // ✅ Clean + Deduplicate + Sort fields
      const fixedProducts = app.products.map((p) => {
        const uniqueMap = new Map<string, Field>();

        (p.fields || []).forEach((f) => {
          if (!uniqueMap.has(f.fieldId)) {
            uniqueMap.set(f.fieldId, f);
          }
        });

        let uniqueFields = Array.from(uniqueMap.values());

        // sort if sortOrder exists
        uniqueFields.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

        return {
          ...p,
          fields: uniqueFields,
        };
      });

      const fixedApp: ActiveApplicationResponse = {
        ...app,
        products: fixedProducts,
      };

      setData(fixedApp);

      if (fixedApp.products.length > 0) {
        setActiveProductId(fixedApp.products[0].productId);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load active application");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActiveApplication();
  }, []);

  /* ================= HANDLERS ================= */

  const handleChange = (key: string, value: any) => {
    setFormValues((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSubmit = () => {
    console.log("FORM VALUES:", formValues);
    toast.success("Form data collected in console");
  };

  /* ================= RENDER FIELD ================= */

  const renderField = (field: Field) => {
    const common =
      "w-full rounded-lg border px-3 py-2 text-sm bg-white text-slate-900 border-slate-300 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700";

    const placeholder = field.placeholder || "";

    switch (field.type) {
      case "NUMBER":
        return (
          <input
            type="number"
            className={common}
            required={field.required}
            min={field.validation?.min}
            max={field.validation?.max}
            placeholder={placeholder}
            onChange={(e) =>
              handleChange(field.fieldKey, Number(e.target.value))
            }
          />
        );

      case "TEXT":
      case "EMAIL":
        return (
          <input
            type="text"
            className={common}
            required={field.required}
            placeholder={placeholder}
            onChange={(e) => handleChange(field.fieldKey, e.target.value)}
          />
        );

      case "FILE":
        return (
          <input
            type="file"
            className={common}
            required={field.required}
            onChange={(e) =>
              handleChange(field.fieldKey, e.target.files?.[0] || null)
            }
          />
        );

      case "TEXTAREA":
        return (
          <textarea
            className={common}
            rows={4}
            required={field.required}
            placeholder={placeholder}
            onChange={(e) => handleChange(field.fieldKey, e.target.value)}
          />
        );

      case "SELECT":
        return (
          <select
            className={common}
            required={field.required}
            onChange={(e) => handleChange(field.fieldKey, e.target.value)}
          >
            <option value="">
              {placeholder || "Select"}
            </option>
            {field.options?.map((o, i) => (
              <option key={i} value={o}>
                {o}
              </option>
            ))}
          </select>
        );

      default:
        return (
          <input
            type="text"
            className={common}
            placeholder={placeholder}
            onChange={(e) => handleChange(field.fieldKey, e.target.value)}
          />
        );
    }
  };


  /* ================= UI ================= */

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="h-12 w-12 rounded-full border-4 border-slate-300 border-t-blue-600 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-sm text-red-500">
        Failed to load active application
      </div>
    );
  }

  const activeProduct = data.products.find(
    (p) => p.productId === activeProductId
  );

  return (
    <div className="min-h-screen p-4 md:p-6 bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      {/* ================= HEADER ================= */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">
          {data.applicationName}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Fill customer details for selected product
        </p>
      </div>

      {/* ================= PRODUCT SELECT ================= */}
      <div className="mb-6 max-w-sm">
        <label className="block text-sm font-medium mb-1">
          Select Product
        </label>
        <select
          value={activeProductId}
          onChange={(e) => setActiveProductId(e.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm bg-white text-slate-900 border-slate-300 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700"
        >
          {data.products.map((p) => (
            <option key={p.productId} value={p.productId}>
              {p.loanProductCode}
            </option>
          ))}
        </select>
      </div>

      {/* ================= FORM CARD ================= */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
        <h2 className="text-lg font-semibold mb-4">
          {activeProduct?.loanProductCode} Application Form
        </h2>

        {/* ================= EMPTY ================= */}
        {(!activeProduct || activeProduct.fields.length === 0) && (
          <div className="flex items-center gap-3 text-slate-400 text-sm">
            📄 No fields configured for this product.
          </div>
        )}

        {/* ================= FIELDS ================= */}
        {activeProduct && activeProduct.fields.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeProduct.fields.map((field) => (
              <div key={field.fieldId} className="space-y-1">
                <label className="text-sm font-medium">
                  {field.label}
                  {field.required && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </label>
                {renderField(field)}
              </div>
            ))}
          </div>
        )}

        {/* ================= ACTION ================= */}
        {activeProduct && activeProduct.fields.length > 0 && (
          <div className="mt-6">
            <button
              onClick={handleSubmit}
              className="bg-[#084e6b] hover:opacity-90 text-white px-6 py-2 rounded-lg text-sm"
            >
              Submit Application
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActiveApplication;
