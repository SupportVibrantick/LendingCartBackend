import { useEffect, useRef, useState } from "react";
import { FileText, Loader2, Pencil, Receipt, X } from "lucide-react";
import toast from "react-hot-toast";
import FeeAgreementDocument from "../../components/FeeAgreementDocument";
import FeeAgreementDownloadButton from "../../components/FeeAgreementDownloadButton";
import { validateFeeAgreementForm } from "../../lib/feeAgreementDisplayUtils";

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
    if (applicationId) void fetchAgreement();
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
        `${API_BASE}/broker/loan-pipeline/${applicationId}/fee-agreement`,
        {
          headers: getAuthHeaders(),
        },
      );

      const json = await res.json();

      if (!res.ok || !json.ok) {
        setData(null);
        return;
      }

      setData(json.data);
    } catch (err: any) {
      toast.error(err.message || "Error loading agreement");
      setData(null);
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
      void fetchAgreement();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const statusLabel = String(data?.status || "DRAFT").replace(/_/g, " ");
  const isSigned = Boolean(data?.clientSignature || data?.signedAt);
  const inputClassName =
    "mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-[#4C78F5]/50 focus:ring-2 focus:ring-[#4C78F5]/15 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-600";

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
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Review broker points, upfront fee, and exclusivity terms for this
            application.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-[#4C78F5] text-white">
            <Receipt size={26} />
          </div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
            No fee agreement yet
          </h3>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            A fee agreement wasn’t included when this loan was created. Include
            fee terms in the loan application wizard next time so the client can
            review and sign them here.
          </p>

          <div className="mt-6 w-full max-w-lg rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-left dark:border-slate-700 dark:bg-slate-900/50">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              What you’ll see once it’s created
            </p>
            <ul className="mt-3 space-y-2.5 text-sm text-slate-600 dark:text-slate-300">
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#4C78F5]/10 text-[11px] font-bold text-[#4C78F5]">
                  1
                </span>
                Broker points, upfront fee, and exclusivity months
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#4C78F5]/10 text-[11px] font-bold text-[#4C78F5]">
                  2
                </span>
                Branded agreement PDF for the client to review
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#4C78F5]/10 text-[11px] font-bold text-[#4C78F5]">
                  3
                </span>
                Client signature status and download
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-none dark:border-slate-800 dark:bg-slate-950">
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-4 dark:border-slate-800 dark:bg-slate-900/40 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4C78F5]">
            Broker fees
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
              Fee Agreement
            </h2>
            <span
              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                isSigned
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-200"
                  : "border-[#4C78F5]/25 bg-[#4C78F5]/8 text-[#3B66E0] dark:border-[#4C78F5]/40 dark:bg-[#4C78F5]/15 dark:text-sky-200"
              }`}
            >
              {isSigned ? "Signed" : statusLabel}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isSigned
              ? "Client has signed this fee agreement."
              : "Review terms below. Update fees before the client signs."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FeeAgreementDownloadButton data={data} pdfRef={pdfRef} />

          {!isSigned ? (
            <button
              type="button"
              onClick={() => {
                setForm(buildFormFromSources(data));
                setErrors({
                  brokerPoints: "",
                  upfrontFee: "",
                  exclusivityMonths: "",
                });
                setIsModalOpen(true);
              }}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#4C78F5] px-3.5 text-sm font-semibold text-white transition hover:bg-[#3B66E0]"
            >
              <Pencil size={15} />
              Update terms
            </button>
          ) : null}
        </div>
      </div>

      <FeeAgreementDocument data={data} pdfRef={pdfRef}>
        <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/40">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Client signature
            </h3>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Signature captured in the client portal after review.
            </p>
          </div>
          <div className="p-4">
            {data.clientSignature ? (
              <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                <img
                  src={data.clientSignature}
                  alt="Client signature"
                  className="mx-auto h-24 w-full object-contain"
                />
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center dark:border-slate-700 dark:bg-slate-900/40">
                <FileText className="mx-auto mb-2 h-5 w-5 text-slate-400" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  Not signed yet
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Waiting for the client to sign in their portal.
                </p>
              </div>
            )}

            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              Signed at:{" "}
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {data.signedAt
                  ? new Date(data.signedAt).toLocaleString()
                  : "Pending"}
              </span>
            </p>
          </div>
        </div>
      </FeeAgreementDocument>

      {isModalOpen ? (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-slate-900/40 p-4">
          <div
            className="absolute inset-0"
            onClick={() => !updating && setIsModalOpen(false)}
            aria-hidden
          />
          <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-none dark:border-slate-700 dark:bg-slate-950">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3.5 dark:border-slate-800">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4C78F5]">
                  Edit terms
                </p>
                <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                  Update Fee Agreement
                </h3>
              </div>
              <button
                type="button"
                disabled={updating}
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg border border-transparent p-1.5 text-slate-400 transition hover:border-slate-200 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50 dark:hover:border-slate-700 dark:hover:bg-slate-800"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 px-4 py-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
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
                  className={`${inputClassName} ${
                    errors.brokerPoints ? "border-rose-500" : ""
                  }`}
                />
                <p className="mt-1.5 text-xs text-slate-500">
                  Loaded from loan application details (read-only).
                </p>
                {errors.brokerPoints ? (
                  <p className="mt-1 text-sm text-rose-600">
                    {errors.brokerPoints}
                  </p>
                ) : null}
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
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
                      setErrors((prev) => ({ ...prev, upfrontFee: "" }));
                    }
                  }}
                  className={`${inputClassName} ${
                    errors.upfrontFee ? "border-rose-500" : ""
                  }`}
                />
                {errors.upfrontFee ? (
                  <p className="mt-1 text-sm text-rose-600">{errors.upfrontFee}</p>
                ) : null}
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
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
                  className={`${inputClassName} ${
                    errors.exclusivityMonths ? "border-rose-500" : ""
                  }`}
                />
                {errors.exclusivityMonths ? (
                  <p className="mt-1 text-sm text-rose-600">
                    {errors.exclusivityMonths}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50/80 px-4 py-3.5 dark:border-slate-800 dark:bg-slate-900/50">
              <button
                type="button"
                disabled={updating}
                onClick={() => setIsModalOpen(false)}
                className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleUpdate()}
                disabled={updating}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#4C78F5] px-4 text-sm font-semibold text-white transition hover:bg-[#3B66E0] disabled:opacity-50"
              >
                {updating ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Updating…
                  </>
                ) : (
                  "Save changes"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
