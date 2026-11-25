import { useEffect, useState } from "react";
import { FileText, Loader2, Pencil } from "lucide-react";
import { useRef } from "react";
import toast from "react-hot-toast";
import FeeAgreementDocument from "../../../components/FeeAgreementDocument";
import FeeAgreementDownloadButton from "../../../components/FeeAgreementDownloadButton";
import { validateFeeAgreementForm } from "../../../lib/feeAgreementDisplayUtils";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

interface Props {
  applicationId: string;
  getAuthHeaders: () => HeadersInit;
  applicationBrokerPoints?: string | number | null;
}

export default function FeeAgreement({
  applicationId,
  getAuthHeaders,
  applicationBrokerPoints = null,
}: Props) {
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

  const resolveApplicationBrokerPoints = () => {
    if (
      applicationBrokerPoints === null ||
      applicationBrokerPoints === undefined ||
      applicationBrokerPoints === ""
    ) {
      return "";
    }

    return String(applicationBrokerPoints).trim();
  };

  const buildFormFromSources = (agreementData: any) => ({
    brokerPoints:
      resolveApplicationBrokerPoints() ||
      (agreementData?.brokerPoints != null
        ? String(agreementData.brokerPoints)
        : ""),
    upfrontFee:
      agreementData?.upfrontFee != null ? String(agreementData.upfrontFee) : "",
    exclusivityMonths:
      agreementData?.exclusivityMonths != null
        ? String(agreementData.exclusivityMonths)
        : "",
  });

  useEffect(() => {
    if (applicationId) fetchAgreement();
  }, [applicationId]);

  useEffect(() => {
    if (data) {
      setForm(buildFormFromSources(data));
    }
  }, [data, applicationBrokerPoints]);

  const fetchAgreement = async () => {
    try {
      setLoading(true);

      const res = await fetch(
        `${API_BASE}/loanofficer/loan-pipeline/${applicationId}/fee-agreement`,
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
        `${API_BASE}/loanofficer/loan-pipeline/${data.id}/fee-agreement`,
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

  if (loading) {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-none dark:border-slate-800 dark:bg-slate-950">
        <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <Loader2 className="h-7 w-7 animate-spin text-[#4C78F5]" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Loading fee agreement…
          </p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-none dark:border-slate-800 dark:bg-slate-950">
        <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-4 dark:border-slate-800 dark:bg-slate-900/40 sm:px-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4C78F5]">
            Broker fees
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
            Fee Agreement
          </h2>
        </div>
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-[#4C78F5] text-white">
            <FileText size={26} />
          </div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
            No fee agreement yet
          </h3>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            A fee agreement wasn’t included with this application yet, or it is
            still being prepared.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-none dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-4 dark:border-slate-800 dark:bg-slate-900/40 sm:px-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4C78F5]">
            Broker fees
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
            Fee Agreement
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Status:{" "}
            <span className="font-semibold text-[#4C78F5] dark:text-sky-300">
              {String(data.status || "").replace(/_/g, " ")}
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
    bg-[#4C78F5] text-white hover:bg-[#3B66E0] transition"
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
                  disabled
                  readOnly
                  className={`w-full mt-1 rounded-lg border px-3 py-2 text-sm outline-none bg-slate-100 text-slate-600 cursor-not-allowed
  ${
    errors.brokerPoints
      ? "border-red-500"
      : "border-slate-200"
  }`}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Loaded from loan application details (read-only)
                </p>
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
      : "focus:ring-2 focus:ring-[#4C78F5]"
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
        : "focus:ring-2 focus:ring-[#4C78F5]"
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
                className="px-4 py-2 text-sm rounded-lg bg-[#4C78F5] text-white hover:bg-[#3B66E0] disabled:opacity-50"
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
