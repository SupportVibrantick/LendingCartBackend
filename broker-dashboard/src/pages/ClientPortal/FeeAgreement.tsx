import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
// import html2canvas from "html2canvas";
// import jsPDF from "jspdf";
import { useRef } from "react";
import toast from "react-hot-toast";
import SignatureCanvas from "react-signature-canvas";
import FeeAgreementDocument from "../../components/FeeAgreementDocument";
import { canClientSignFeeAgreement } from "../../lib/feeAgreementDisplayUtils";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

interface Props {
  applicationId: string;
  getAuthHeaders: () => HeadersInit;
  onBack: () => void;
}

export default function FeeAgreement({
  applicationId,
  getAuthHeaders,
  onBack,
}: Props) {
  const pdfRef = useRef<HTMLDivElement>(null);
  const sigRef = useRef<SignatureCanvas | null>(null);
  const [signing, setSigning] = useState(false);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [form, setForm] = useState({
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

  const handleSignAgreement = async () => {
    try {
      if (!canClientSignFeeAgreement(data)) {
        toast.error(
          "Fee terms are not finalized yet. Please wait for your broker to update broker fee, upfront fee, and exclusivity period.",
        );
        return;
      }

      if (!sigRef.current || sigRef.current.isEmpty()) {
        toast.error("Please provide signature");
        return;
      }

      setSigning(true);

      const sign = sigRef.current.getCanvas().toDataURL("image/png");

      const res = await fetch(
        `${API_BASE}/client-portal/${applicationId}/fee-agreement/sign`,
        {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ signature: sign }),
        },
      );

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.ok) {
        throw new Error(
          json.message ||
            "Failed to sign agreement. Fee terms may not be finalized yet.",
        );
      }

      toast.success("Agreement signed successfully");

      sigRef.current.clear();

      await fetchAgreement();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSigning(false);
    }
  };

  const fetchAgreement = async () => {
    try {
      setLoading(true);

      const res = await fetch(
        `${API_BASE}/client-portal/applications/${applicationId}/fee-agreement`,
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
      setUpdating(true);

      const res = await fetch(
        `${API_BASE}/broker/loan-pipeline/${data.id}/fee-agreement`,
        {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            brokerPoints: Number(form.brokerPoints),
            upfrontFee: Number(form.upfrontFee),
            exclusivityMonths: Number(form.exclusivityMonths),
          }),
        },
      );

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error("Failed to update agreement");
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
      <>
        <div className="flex items-center justify-between mb-4">
          {/* Back Button */}
          <button
            onClick={onBack}
            className="flex text-xs items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition"
          >
            ← Back
          </button>
        </div>

        <div
          className="rounded-2xl border-2 border-dashed border-indigo-300 
        bg-gradient-to-br from-indigo-50 via-white to-cyan-50 
        py-20 px-6 text-center flex flex-col items-center gap-4"
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
      </>
    );
  }

  const feeTermsReady = canClientSignFeeAgreement(data);

  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
      {/* HEADER */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-indigo-50 to-cyan-50">
        <div className="flex items-center justify-between gap-3">
          {/* LEFT SIDE */}
          <div className="flex items-center gap-4">
            {/* BACK BUTTON */}
            <div className="flex items-center justify-between mb-4">
              {/* Back Button */}
              <button
                onClick={onBack}
                className="flex text-xs items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition"
              >
                ← Back
              </button>
            </div>

            {/* TITLE */}
            <div>
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-indigo-100 text-indigo-600">
                  <FileText size={16} />
                </span>
                Fee Agreement
              </h2>

              <p className="text-xs text-gray-500 mt-0.5">
                Status:{" "}
                <span className="px-2 py-[2px] rounded-full bg-indigo-50 text-indigo-600 font-semibold">
                  {data.status}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <FeeAgreementDocument data={data} pdfRef={pdfRef} currencySymbol="₹">
        {/* SIGNATURE */}
        <div className="border-t pt-6">
          <h3 className="font-semibold mb-3">Signature</h3>

          {data.clientSignature ? (
            <div className="text-center">
              <img
                src={data.clientSignature}
                className="h-34 w-full object-contain border rounded-md p-2 mx-auto"
              />
              <p className="text-xs text-green-600 mt-2 font-medium">
                ✔ Signed Successfully
              </p>
            </div>
          ) : !feeTermsReady ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Signing is unavailable until your broker sets the broker fee,
              upfront fee, and exclusivity period on this agreement.
            </div>
          ) : (
            <>
              <div className="bg-white border-2 border-dashed rounded-xl p-3">
                <div className="w-full h-40">
                  <SignatureCanvas
                    ref={sigRef as any}
                    canvasProps={{
                      className: "w-full h-full",
                    }}
                  />
                </div>
              </div>

              <div className="flex justify-between mt-3">
                <button
                  onClick={() => sigRef.current?.clear()}
                  className="text-xs px-3 py-1 rounded-md border"
                >
                  Clear
                </button>

                <button
                  onClick={handleSignAgreement}
                  disabled={signing}
                  className="text-xs px-4 py-1 rounded-md bg-green-600 text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {signing ? "Signing..." : "Sign Agreement"}
                </button>
              </div>
            </>
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
                  value={form.brokerPoints}
                  onChange={(e) =>
                    setForm({ ...form, brokerPoints: e.target.value })
                  }
                  className="w-full mt-1 rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              {/* Upfront Fee */}
              <div>
                <label className="text-sm font-medium text-gray-600">
                  Upfront Fee
                </label>
                <input
                  type="number"
                  value={form.upfrontFee}
                  onChange={(e) =>
                    setForm({ ...form, upfrontFee: e.target.value })
                  }
                  className="w-full mt-1 rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              {/* Exclusivity */}
              <div>
                <label className="text-sm font-medium text-gray-600">
                  Exclusivity (Months)
                </label>
                <input
                  type="number"
                  value={form.exclusivityMonths}
                  onChange={(e) =>
                    setForm({ ...form, exclusivityMonths: e.target.value })
                  }
                  className="w-full mt-1 rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
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
