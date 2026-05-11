import { useEffect, useState, FormEvent } from "react";
import axios, { AxiosError } from "axios";

/* ================= API ================= */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "http://localhost:4000",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("admin_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/* ================= TYPES ================= */
interface Lender {
  id: string;
  name: string;
}

interface LoanProduct {
  id: string;
  name: string;
  code: string;
}

interface MessageState {
  type: "success" | "error";
  text: string;
}

interface Errors {
  lenderOrgId?: string;
  loanProductCode?: string;
  minLoanAmount?: string;
  maxLoanAmount?: string;
  minTermMonths?: string;
  maxTermMonths?: string;
}

interface FormState {
  lenderOrgId: string;
  loanProductCode: string;
  minLoanAmount: string;
  maxLoanAmount: string;
  minTermMonths: string;
  maxTermMonths: string;
  regionsSupported: string[];
  industriesSupported: string[];
  isActive: boolean;
}

/* ================= COMPONENT ================= */
export default function LenderProductAssign() {
  const [lenders, setLenders] = useState<Lender[]>([]);
  const [loanProducts, setLoanProducts] = useState<LoanProduct[]>([]);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState<MessageState | null>(null);

  const [form, setForm] = useState<FormState>({
    lenderOrgId: "",
    loanProductCode: "",
    minLoanAmount: "",
    maxLoanAmount: "",
    minTermMonths: "",
    maxTermMonths: "",
    regionsSupported: [],
    industriesSupported: [],
    isActive: true,
  });

  /* ================= LOAD DATA ================= */
  useEffect(() => {
    async function loadData() {
      try {
        const [lendersRes, productsRes] = await Promise.all([
          api.get("/admin/lenders/read"),
          api.get("/admin/loan-products/list"),
        ]);

        // LENDERS → paginated
        setLenders(lendersRes.data?.data?.results ?? []);

        // PRODUCTS → direct array
        setLoanProducts(productsRes.data?.data ?? []);
      } catch (err) {
        setMessage({ type: "error", text: "Failed to load data" });
      }
    }

    loadData();
  }, []);

  /* ================= VALIDATION ================= */
  function validate(): Errors {
    const e: Errors = {};

    if (!form.lenderOrgId) e.lenderOrgId = "Please select a lender";
    if (!form.loanProductCode) e.loanProductCode = "Please select a product";

    if (form.minLoanAmount && isNaN(Number(form.minLoanAmount)))
      e.minLoanAmount = "Invalid amount";

    if (form.maxLoanAmount && isNaN(Number(form.maxLoanAmount)))
      e.maxLoanAmount = "Invalid amount";

    if (
      form.minLoanAmount &&
      form.maxLoanAmount &&
      Number(form.minLoanAmount) > Number(form.maxLoanAmount)
    )
      e.maxLoanAmount = "Max must be ≥ Min";

    if (form.minTermMonths && isNaN(Number(form.minTermMonths)))
      e.minTermMonths = "Invalid months";

    if (form.maxTermMonths && isNaN(Number(form.maxTermMonths)))
      e.maxTermMonths = "Invalid months";

    if (
      form.minTermMonths &&
      form.maxTermMonths &&
      Number(form.minTermMonths) > Number(form.maxTermMonths)
    )
      e.maxTermMonths = "Max term must be ≥ Min term";

    return e;
  }

  /* ================= SUBMIT ================= */
  async function handleSubmit(e: FormEvent) {
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
      await api.post("/admin/lender-products/create", {
        ...form,
        minLoanAmount: form.minLoanAmount
          ? Number(form.minLoanAmount)
          : undefined,
        maxLoanAmount: form.maxLoanAmount
          ? Number(form.maxLoanAmount)
          : undefined,
        minTermMonths: form.minTermMonths
          ? Number(form.minTermMonths)
          : undefined,
        maxTermMonths: form.maxTermMonths
          ? Number(form.maxTermMonths)
          : undefined,
      });

      setMessage({
        type: "success",
        text: "Lender product assigned successfully",
      });

      setForm((f) => ({
        ...f,
        loanProductCode: "",
        minLoanAmount: "",
        maxLoanAmount: "",
        regionsSupported: [],
        industriesSupported: [],
      }));
    } catch (err) {
      const error = err as AxiosError<any>;
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Server error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  /* ================= TOGGLE ================= */
  function toggleChip(
    key: "regionsSupported" | "industriesSupported",
    value: string,
  ) {
    setForm((prev) => {
      const set = new Set(prev[key]);
      set.has(value) ? set.delete(value) : set.add(value);
      return { ...prev, [key]: Array.from(set) };
    });
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-xl shadow">
      <h2 className="text-2xl font-semibold mb-4">Assign Product to Lender</h2>

      {message && (
        <div
          className={`p-3 mb-4 rounded ${message.type === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">Lender</label>
            <select
              value={form.lenderOrgId}
              onChange={(e) =>
                setForm({ ...form, lenderOrgId: e.target.value })
              }
              className="mt-1 block w-full rounded-md border p-2"
            >
              <option value="">Select lender</option>
              {lenders.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            {errors.lenderOrgId && (
              <p className="text-xs text-red-600">{errors.lenderOrgId}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium">Loan Product</label>
            <select
              value={form.loanProductCode}
              onChange={(e) =>
                setForm({ ...form, loanProductCode: e.target.value })
              }
              className="mt-1 block w-full rounded-md border p-2"
            >
              <option value="">Select product</option>
              {loanProducts.map((p) => (
                <option key={p.id} value={p.code}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
            {errors.loanProductCode && (
              <p className="text-xs text-red-600">{errors.loanProductCode}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium">Min Amount</label>
            <input
              type="text"
              value={form.minLoanAmount}
              onChange={(e) =>
                setForm({ ...form, minLoanAmount: e.target.value })
              }
              className="mt-1 block w-full rounded-md border p-2"
              placeholder="e.g. 50000"
            />
            {errors.minLoanAmount && (
              <p className="text-xs text-red-600">{errors.minLoanAmount}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium">Max Amount</label>
            <input
              type="text"
              value={form.maxLoanAmount}
              onChange={(e) =>
                setForm({ ...form, maxLoanAmount: e.target.value })
              }
              className="mt-1 block w-full rounded-md border p-2"
              placeholder="e.g. 2500000"
            />
            {errors.maxLoanAmount && (
              <p className="text-xs text-red-600">{errors.maxLoanAmount}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium">
              Min Term (months)
            </label>
            <input
              type="number"
              value={form.minTermMonths}
              onChange={(e) =>
                setForm({ ...form, minTermMonths: e.target.value })
              }
              className="mt-1 block w-full rounded-md border p-2"
            />
            {errors.minTermMonths && (
              <p className="text-xs text-red-600">{errors.minTermMonths}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium">
              Max Term (months)
            </label>
            <input
              type="number"
              value={form.maxTermMonths}
              onChange={(e) =>
                setForm({ ...form, maxTermMonths: e.target.value })
              }
              className="mt-1 block w-full rounded-md border p-2"
            />
            {errors.maxTermMonths && (
              <p className="text-xs text-red-600">{errors.maxTermMonths}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">Regions (toggle)</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {["CA", "TX", "FL", "NY", "NJ"].map((r) => (
              <button
                type="button"
                key={r}
                onClick={() => toggleChip("regionsSupported", r)}
                className={`px-3 py-1 rounded-full border ${form.regionsSupported.includes(r) ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">
            Industries (toggle)
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {["Retail", "Logistics", "Construction", "Healthcare"].map((i) => (
              <button
                type="button"
                key={i}
                onClick={() => toggleChip("industriesSupported", i)}
                className={`px-3 py-1 rounded-full border ${form.industriesSupported.includes(i) ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
              >
                {i}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            <span className="text-sm">Active</span>
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="ml-auto px-4 py-2 rounded bg-indigo-600 text-white disabled:opacity-50"
          >
            {submitting ? "Assigning..." : "Assign Product"}
          </button>
        </div>
      </form>
    </div>
  );
}
