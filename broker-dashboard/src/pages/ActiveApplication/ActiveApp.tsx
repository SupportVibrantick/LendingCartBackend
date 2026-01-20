import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

/* ================= TYPES ================= */

type Field = {
  fieldId: string;
  fieldKey: string;
  label: string;
  type: "TEXT" | "NUMBER" | "EMAIL" | "FILE" | "TEXTAREA" | "SELECT";
  required: boolean;
  options: string[] | null;
};

type Product = {
  productId: string;
  loanProductCode: string;
  fields: Field[];
};

type ActiveApplicationResponse = {
  applicationId: string;
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
      console.log("app:", app)

      setData(app);

      if (app.products.length > 0) {
        setActiveProductId(app.products[0].productId);
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
      "w-full rounded-lg border px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-700";

    switch (field.type) {
      case "NUMBER":
      case "TEXT":
      case "EMAIL":
        return (
          <input
            type={field.type === "NUMBER" ? "number" : "text"}
            className={common}
            required={field.required}
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
            onChange={(e) => handleChange(field.fieldKey, e.target.value)}
          />
        );

      default:
        return (
          <input
            type="text"
            className={common}
            onChange={(e) => handleChange(field.fieldKey, e.target.value)}
          />
        );
    }
  };

  /* ================= UI ================= */

  if (loading) {
    return (
      <div className="p-6 text-sm text-slate-400">Loading active application...</div>
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
    <div className="p-4 md:p-6 text-gray-900 dark:text-gray-100">
      {/* ================= HEADER ================= */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Active Loan Application</h1>
        <p className="text-sm text-slate-400">
          Fill customer details for selected product
        </p>
      </div>

      {/* ================= PRODUCT TABS ================= */}
      <div className="flex flex-wrap gap-2 mb-6">
        {data.products.map((p) => (
          <button
            key={p.productId}
            onClick={() => setActiveProductId(p.productId)}
            className={`px-4 py-2 rounded-lg text-sm border transition
              ${
                activeProductId === p.productId
                  ? "bg-[#084e6b] text-white border-[#084e6b]"
                  : "bg-transparent border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }
            `}
          >
            {p.loanProductCode}
          </button>
        ))}
      </div>

      {/* ================= FORM CARD ================= */}
      <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-5">
        <h2 className="text-lg font-semibold mb-4">
          {activeProduct?.loanProductCode} Application Form
        </h2>

        {/* ================= EMPTY ================= */}
        {(!activeProduct || activeProduct.fields.length === 0) && (
          <div className="flex items-center gap-3 text-slate-400 text-sm">
            <span className="text-xl">📄</span>
            No fields configured for this product.
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
