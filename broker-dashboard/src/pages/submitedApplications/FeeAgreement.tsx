import { useEffect, useState } from "react";
import { FileText, Pencil } from "lucide-react";
import { useRef } from "react";
import toast from "react-hot-toast";
import FeeAgreementDocument from "../../components/FeeAgreementDocument";
import FeeAgreementDownloadButton from "../../components/FeeAgreementDownloadButton";
import { validateFeeAgreementForm } from "../../lib/feeAgreementDisplayUtils";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

interface Props {
  applicationId: string;
  getAuthHeaders: () => HeadersInit;
}

export default function FeeAgreement({ applicationId, getAuthHeaders }: Props) {
  const pdfRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [form, setForm] = useState({
    brokerPoints: "",
    upfrontFee: "",
    exclusivityMonths: "",
  });

  const [errors, setErrors] = useState({
  brokerPoints: "",
  upfrontFee: "",
  exclusivityMonths: "",
});

  useEffect(() => {
    if (applicationId) fetchAgreement();
  }, [applicationId]);

  useEffect(() => {
    if (data) {
      setForm({
        brokerPoints: data.brokerPoints || "",
        upfrontFee: data.upfrontFee || "",
        exclusivityMonths: data.exclusivityMonths || "",
      });
    }
  }, [data]);

  const fetchAgreement = async () => {
    try {
      setLoading(true);

      const res = await fetch(
        `${API_BASE}/broker/loan-pipeline/${applicationId}/fee-agreement`,
        {
          headers: getAuthHeaders(),
        },
      );

      const json = await res.json();

      if (!res.ok || !json.ok) {
        console.error("Failed to fetch agreement");
      }

      setData(json.data);
    } catch (err: any) {
      toast.error(err.message || "Error loading agreement");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    try {
      const newErrors = validateFeeAgreementForm(form);

      if (
        newErrors.brokerPoints ||
        newErrors.upfrontFee ||
        newErrors.exclusivityMonths
      ) {
        setErrors(newErrors);
        return;
      }

      setErrors({
        brokerPoints: "",
        upfrontFee: "",
        exclusivityMonths: "",
      });

      setUpdating(true);

      const res = await fetch(
        `${API_BASE}/broker/loan-pipeline/${data.id}/fee-agreement`,
        {
          method: "PATCH",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            brokerPoints: Number(form.brokerPoints),
            upfrontFee: Number(form.upfrontFee),
            exclusivityMonths: Number(form.exclusivityMonths),
          }),
        },
      );

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.message || "Failed to update agreement");
      }

      toast.success("Fee Agreement updated successfully");

      setIsModalOpen(false);
      fetchAgreement();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUpdating(false);
    }
  };

  // Loading
  if (loading) {
    return (
      <div className="py-20 text-center text-gray-500">
        Loading Fee Agreement...
      </div>
    );
  }

  // Empty State
  if (!data) {
    return (
      <div
        className="rounded-2xl border-2 border-dashed border-slate-300 
bg-slate-50 py-20 px-6 text-center flex flex-col items-center gap-4
dark:border-slate-700 dark:bg-slate-900"
      >
        <div
          className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 
          flex items-center justify-center shadow-sm"
        >
          <FileText className="text-white" size={28} />
        </div>

        <p className="text-base font-semibold text-gray-700">
          No Fee Agreement Found
        </p>

        <p className="text-sm text-gray-500 max-w-sm">
          Agreement not generated yet or still under process.
        </p>
      </div>
    );
  }

  return (
    <div
      className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden 
dark:bg-slate-900 dark:border-slate-800"
    >
      {/* HEADER */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b 
bg-slate-50 dark:bg-slate-900 dark:border-slate-800"
      >
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            Fee Agreement
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Status:{" "}
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">
              {data.status}
            </span>
          </p>
        </div>

        {/* UPDATE BUTTON */}
        <div className="flex items-center gap-2">
          <FeeAgreementDownloadButton data={data} pdfRef={pdfRef} />

          {!data.clientSignature && !data.signedAt && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-xs rounded-lg 
    bg-[#2C92D5] text-white hover:bg-indigo-500 transition"
            >
              <Pencil size={14} />
              Update
            </button>
          )}
        </div>
      </div>

      {/* CONTENT */}
      <FeeAgreementDocument data={data} pdfRef={pdfRef}>
        {/* SIGNATURE */}
        <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
          <h3 className="font-semibold mb-2">Signature</h3>

          {data.clientSignature ? (
            <div className="flex justify-center">
              <div
                className="w-full border border-slate-200 rounded-lg p-3 bg-white 
dark:border-slate-700 dark:bg-slate-800"
              >
                <img
                  src={data.clientSignature}
                  className="w-full h-24 object-contain mx-auto"
                />
              </div>
            </div>
          ) : (
            <p className="text-slate-400 italic dark:text-slate-500">
              Not signed yet
            </p>
          )}

          <p className="text-xs text-gray-500 mt-2">
            Signed At:{" "}
            {data.signedAt
              ? new Date(data.signedAt).toLocaleString()
              : "Pending"}
          </p>
        </div>
      </FeeAgreementDocument>

      {isModalOpen && (
        <div className="fixed inset-0 z-999999 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6 relative">
            {/* HEADER */}
            <h3 className="text-lg font-semibold mb-4 text-gray-800">
              Update Fee Agreement 
            </h3>
  
            {/* FORM */}
            <div className="space-y-4">
              {/* Broker Points */}
              <div>
                <label className="text-sm font-medium text-gray-600">
                  Broker Points (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={form.brokerPoints}
  onChange={(e) => {
    setForm({ ...form, brokerPoints: e.target.value });

    if (errors.brokerPoints) {
      setErrors((prev) => ({
        ...prev,
        brokerPoints: "",
      }));
    }
  }}
  className={`w-full mt-1 rounded-lg border px-3 py-2 text-sm outline-none
  ${
    errors.brokerPoints
      ? "border-red-500 focus:ring-2 focus:ring-red-500"
      : "focus:ring-2 focus:ring-indigo-500"
  }`}
/>

{errors.brokerPoints && (
  <p className="mt-1 text-xs text-red-500">
    {errors.brokerPoints}
  </p>
)}
              </div>

              {/* Upfront Fee */}
              <div>
                <label className="text-sm font-medium text-gray-600">
                  Upfront Fee
                </label>
                <input
                  type="number"
                  min={0}
                  max={99999999.99}
                  step="0.01"
                  value={form.upfrontFee}
                   onChange={(e) => {
    setForm({ ...form, upfrontFee: e.target.value });

    if (errors.upfrontFee) {
      setErrors((prev) => ({
        ...prev,
        upfrontFee: "",
      }));
    }
  }}
                   className={`w-full mt-1 rounded-lg border px-3 py-2 text-sm outline-none
  ${
    errors.upfrontFee
      ? "border-red-500 focus:ring-2 focus:ring-red-500"
      : "focus:ring-2 focus:ring-indigo-500"
  }`}
                />
                {errors.upfrontFee && (
  <p className="mt-1 text-xs text-red-500">
    {errors.upfrontFee}
  </p>
)}
              </div>

              {/* Exclusivity */}
              <div>
                <label className="text-sm font-medium text-gray-600">
                  Exclusivity (Months)
                </label>
<input
  type="number"
  value={form.exclusivityMonths}
  onChange={(e) => {
    setForm({ ...form, exclusivityMonths: e.target.value });

    if (errors.exclusivityMonths) {
      setErrors((prev) => ({
        ...prev,
        exclusivityMonths: "",
      }));
    }
  }}
  className={`w-full mt-1 rounded-lg border px-3 py-2 text-sm outline-none
    ${
      errors.exclusivityMonths
        ? "border-red-500 focus:ring-2 focus:ring-red-500"
        : "focus:ring-2 focus:ring-indigo-500"
    }`}
/>

{errors.exclusivityMonths && (
  <p className="mt-1 text-xs text-red-500">
    {errors.exclusivityMonths}
  </p>
)}
              </div>
            </div>

            {/* ACTIONS */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm rounded-lg border"
              >
                Cancel
              </button>

              <button
                onClick={handleUpdate}
                disabled={updating}
                className="px-4 py-2 text-sm rounded-lg bg-[#2C92D5] text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {updating ? "Updating..." : "Update"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
