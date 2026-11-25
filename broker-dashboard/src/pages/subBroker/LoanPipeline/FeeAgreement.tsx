import { useEffect, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { useRef } from "react";
import toast from "react-hot-toast";
import FeeAgreementDocument from "../../../components/FeeAgreementDocument";
import FeeAgreementDownloadButton from "../../../components/FeeAgreementDownloadButton";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

interface Props {
  applicationId: string;
}

export default function FeeAgreement({ applicationId }: Props) {
  const pdfRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (applicationId) fetchAgreement();
  }, [applicationId]);

  const fetchAgreement = async () => {
    try {
      setLoading(true);

      const token = sessionStorage.getItem("sub_broker_token");

      const res = await fetch(
        `${API_BASE}/subbroker/fee-agreement/${applicationId}/fee-agreement`,
        {
          headers: {
            "Content-Type": "application/json",
            ...(token && {
              Authorization: `Bearer ${token}`,
            }),
          },
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

        <FeeAgreementDownloadButton data={data} pdfRef={pdfRef} />
      </div>

      <FeeAgreementDocument data={data} pdfRef={pdfRef}>
        <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
          <h3 className="font-semibold mb-2">Signature</h3>

          {data.clientSignature ? (
            <div className="flex justify-center">
              <div className="w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
                <img
                  src={data.clientSignature}
                  className="mx-auto h-24 w-full object-contain"
                />
              </div>
            </div>
          ) : (
            <p className="text-slate-400 italic dark:text-slate-500">
              Not signed yet
            </p>
          )}

          <p className="mt-2 text-xs text-gray-500">
            Signed At:{" "}
            {data.signedAt
              ? new Date(data.signedAt).toLocaleString()
              : "Pending"}
          </p>
        </div>
      </FeeAgreementDocument>
    </div>
  );
}
