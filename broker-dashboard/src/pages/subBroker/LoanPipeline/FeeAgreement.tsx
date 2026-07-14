import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
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
      <div className="py-20 text-center text-gray-500">
        Loading Fee Agreement...
      </div>
    );
  }

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
