import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
// import html2canvas from "html2canvas";
// import jsPDF from "jspdf";
import { useRef } from "react";
import toast from "react-hot-toast";
import SignatureCanvas from "react-signature-canvas";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

interface Props {
  applicationId: string;
  getAuthHeaders: () => HeadersInit;
}

export default function FeeAgreement({ applicationId, getAuthHeaders }: Props) {
  const pdfRef = useRef<HTMLDivElement>(null);
  const sigRef = useRef<SignatureCanvas | null>(null);
  //   const [signature, setSignature] = useState("");
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

      if (!res.ok) throw new Error("Failed to sign");

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
    );
  }

  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
      {/* HEADER */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-indigo-50 to-cyan-50">
        <div>
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <FileText size={18} />
            Fee Agreement
          </h2>
          <p className="text-xs text-gray-500">
            Status:{" "}
            <span className="font-semibold text-indigo-600">{data.status}</span>
          </p>
        </div>
      </div>

      {/* CONTENT */}
      <div
        ref={pdfRef}
        className="p-6 space-y-6 text-sm text-gray-700 leading-relaxed"
      >
        <div className="text-center space-y-2">
          {/* LOGO */}
          <div className="flex justify-center">
            <img
              src="/ACOM_LOGO.jpeg"
              alt="ACOM Logo"
              className="h-12 object-contain"
            />
          </div>

          {/* TITLE */}
          <h1 className="text-xl font-bold">FINDER & FINANCIAL AGREEMENT</h1>

          <p className="text-xs text-gray-500">
            Date: {new Date(data.createdAt).toLocaleDateString()}
          </p>
        </div>

        {/* INTRO */}
        <div>
          <p>
            This Finder & Financial Agreement is made and entered into on{" "}
            <b>{new Date(data.createdAt).toLocaleDateString()}</b> by and
            between{" "}
            <b>
              {data.clientName} ({data.clientEntityName})
            </b>
            , whose address is <b>{data.clientAddress || "—"}</b> ("Issuer"),
            and{" "}
            <b>
              {data.brokerName || "—"} ({data.brokerCompany || "—"})
            </b>
            , whose address is <b>{data.brokerAddress || "—"}</b> ("Finder").
          </p>
        </div>

        {/* SUBJECT */}
        <div>
          <p>
            <b>Subject Property / Business Address:</b>{" "}
            {data.subjectAddress || "—"}
          </p>
        </div>

        {/* SECTION 1 */}
        <div>
          <h2 className="font-semibold text-base mb-2">1. THE AGREEMENT</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Issuer agrees to engage in financial transactions including loan,
              equity investment, lease, credit facility, or similar.
            </li>
            <li>Finder acts solely as an intermediary.</li>
            <li>All fees payable at closing.</li>
            <li>
              Issuer shall not directly approach lenders introduced by Finder
              for 36 months.
            </li>
            <li>
              Agreement remains valid for {data.exclusivityMonths || 12} months.
            </li>
          </ul>
        </div>

        {/* SECTION 2 */}
        <div>
          <h2 className="font-semibold text-base mb-2">2. THE FEE</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
            <div className="p-4 border rounded-xl bg-indigo-50">
              <p className="text-xs text-gray-500">Broker Fee</p>
              <p className="font-semibold text-indigo-700">
                {data.brokerPoints || 0} %
              </p>
            </div>

            <div className="p-4 border rounded-xl bg-cyan-50">
              <p className="text-xs text-gray-500">Upfront Fee</p>
              <p className="font-semibold text-cyan-700">
                ₹{Number(data.upfrontFee || 0).toLocaleString()}
              </p>
            </div>

            <div className="p-4 border rounded-xl bg-purple-50">
              <p className="text-xs text-gray-500">Exclusivity Period</p>
              <p className="font-semibold text-purple-700">
                {data.exclusivityMonths || 0} Months
              </p>
            </div>
          </div>
        </div>

        {/* SECTION 3 */}
        <div>
          <h2 className="font-semibold text-base mb-2">3. GOVERNING LAW</h2>
          <p>
            This agreement shall be governed by the laws of the State of{" "}
            <b>{data.brokerState || "—"}</b>. Any dispute shall be resolved in
            Supreme Court, <b>{data.brokerCounty || "—"}</b> County, State of{" "}
            <b>{data.brokerState || "—"}</b>.
          </p>
        </div>

        {/* SECTION 4 */}
        <div>
          <h2 className="font-semibold text-base mb-2">4. EXCLUSIVITY</h2>
          <p>
            Finder will act as exclusive advisor for{" "}
            <b>{data.exclusivityMonths || 0} months</b> for the above
            transactions.
          </p>
        </div>

        {/* BROKER DETAILS */}
        <div className="border-t pt-4">
          <h3 className="font-semibold mb-2">Broker / Finder Details</h3>
          <p>
            <b>Name:</b> {data.brokerName || "—"}
          </p>
          <p>
            <b>Company:</b> {data.brokerCompany || "—"}
          </p>
          <p>
            <b>Email:</b> {data.brokerEmail || "—"}
          </p>
          <p>
            <b>Phone:</b> {data.brokerPhone || "—"}
          </p>
          <p>
            <b>Address:</b> {data.brokerAddress || "—"}
          </p>
        </div>

        {/* CLIENT DETAILS */}
        <div className="border-t pt-4">
          <h3 className="font-semibold mb-2">Borrower / Client Details</h3>
          <p>
            <b>Name:</b> {data.clientName}
          </p>
          <p>
            <b>Entity:</b> {data.clientEntityName}
          </p>
          <p>
            <b>Email:</b> {data.clientEmail}
          </p>
          <p>
            <b>Phone:</b> {data.clientPhone || "—"}
          </p>
          <p>
            <b>Address:</b> {data.clientAddress || "—"}
          </p>
        </div>

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
          ) : (
            <>
              {/* SIGN PAD */}
              <div className="bg-white border-2 border-dashed rounded-xl p-3">
                <div className="w-full h-40">
                  <SignatureCanvas
                    ref={sigRef as any}
                    // penColor="black"
                    canvasProps={{
                      className: "w-full h-full",
                    }}
                  />
                </div>
              </div>

              {/* ACTIONS */}
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
                  className="text-xs px-4 py-1 rounded-md bg-green-600 text-white"
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
      </div>

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
