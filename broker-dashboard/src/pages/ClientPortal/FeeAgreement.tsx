import { useEffect, useState, useRef } from "react";
import { Clock3, FileText, Loader2, PenLine, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import SignatureCanvas from "react-signature-canvas";
import FeeAgreementDocument from "../../components/FeeAgreementDocument";
import FeeAgreementDownloadButton from "../../components/FeeAgreementDownloadButton";
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

  useEffect(() => {
    if (applicationId) fetchAgreement();
  }, [applicationId]);

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

  if (loading) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 rounded-[10px] border border-[#E2E8F0] bg-white text-[#64748B]">
        <Loader2 className="h-7 w-7 animate-spin text-[#4C78F5]" />
        <p className="text-[14px] font-medium">Loading fee agreement…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white">
        <div className="border-b border-[#E2E8F0] px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#4C78F5]/10 text-[#4C78F5]">
              <FileText size={16} />
            </span>
            <div>
              <h2 className="text-[16px] font-semibold text-[#111827]">
                Fee Agreement
              </h2>
              <p className="text-[12px] text-[#64748B]">
                Waiting for your broker to attach terms
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center px-6 py-16 text-center sm:py-20">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-[14px] bg-[#F7F9FC] text-[#4C78F5] ring-1 ring-[#E2E8F0]">
            <FileText size={30} />
          </div>
          <p className="text-[18px] font-semibold text-[#111827]">
            No fee agreement yet
          </p>
          <p className="mt-2 max-w-md text-[14px] leading-relaxed text-[#64748B]">
            Your broker has not included a fee agreement for this application.
            It will appear here automatically once it is added.
          </p>

          <div className="mt-8 grid w-full max-w-lg gap-3 sm:grid-cols-2">
            <div className="rounded-[10px] border border-[#E2E8F0] bg-[#F7F9FC] px-4 py-3 text-left">
              <div className="mb-1.5 flex items-center gap-2 text-[#4C78F5]">
                <Clock3 size={14} />
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">
                  Status
                </span>
              </div>
              <p className="text-[13px] font-medium text-[#111827]">
                Not sent by broker
              </p>
            </div>
            <div className="rounded-[10px] border border-[#E2E8F0] bg-[#F7F9FC] px-4 py-3 text-left">
              <div className="mb-1.5 flex items-center gap-2 text-[#4C78F5]">
                <ShieldCheck size={14} />
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">
                  Next step
                </span>
              </div>
              <p className="text-[13px] font-medium text-[#111827]">
                We’ll notify you when ready
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onBack}
            className="mt-8 inline-flex items-center gap-2 rounded-[8px] bg-[#4C78F5] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#3B66E0]"
          >
            Back to Loan Application
          </button>
        </div>
      </div>
    );
  }

  const feeTermsReady = canClientSignFeeAgreement(data);
  const statusLabel = String(data.status || "PENDING").replace(/_/g, " ");
  const isSigned = Boolean(data.clientSignature);

  return (
    <div className="overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#4C78F5]/10 text-[#4C78F5]">
            <FileText size={16} />
          </span>
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold text-[#111827]">
              Fee Agreement
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  isSigned
                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                    : "bg-[#4C78F5]/10 text-[#4C78F5] ring-1 ring-[#4C78F5]/15"
                }`}
              >
                {statusLabel}
              </span>
              <span className="text-[12px] text-[#64748B]">
                {isSigned
                  ? "Signed and on file"
                  : feeTermsReady
                    ? "Ready for your signature"
                    : "Awaiting broker fee terms"}
              </span>
            </div>
          </div>
        </div>

        <FeeAgreementDownloadButton data={data} pdfRef={pdfRef} />
      </div>

      <FeeAgreementDocument data={data} pdfRef={pdfRef} currencySymbol="₹">
        <div className="mt-2 border-t border-[#E2E8F0] pt-6">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#4C78F5]/10 text-[#4C78F5]">
              <PenLine size={15} />
            </span>
            <div>
              <h3 className="text-[15px] font-semibold text-[#111827]">
                Signature
              </h3>
              <p className="text-[12px] text-[#64748B]">
                Confirm the agreement terms with your digital signature
              </p>
            </div>
          </div>

          {isSigned ? (
            <div className="rounded-[10px] border border-emerald-100 bg-emerald-50/50 p-5 text-center">
              <img
                src={data.clientSignature}
                alt="Client signature"
                className="mx-auto h-28 w-full max-w-md object-contain rounded-lg border border-[#E2E8F0] bg-white p-3"
              />
              <p className="mt-3 text-[13px] font-semibold text-emerald-700">
                Signed successfully
              </p>
            </div>
          ) : !feeTermsReady ? (
            <div className="rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
              Signing is unavailable until your broker sets the broker fee,
              upfront fee, and exclusivity period on this agreement.
            </div>
          ) : (
            <>
              <div className="rounded-[10px] border-2 border-dashed border-[#4C78F5]/30 bg-[#F7F9FC] p-3">
                <div className="h-40 w-full overflow-hidden rounded-lg bg-white">
                  <SignatureCanvas
                    ref={sigRef as any}
                    canvasProps={{
                      className: "h-full w-full touch-none",
                    }}
                  />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => sigRef.current?.clear()}
                  className="rounded-[8px] border border-[#E2E8F0] bg-white px-3 py-2 text-[12px] font-semibold text-[#64748B] transition hover:bg-[#F7F9FC]"
                >
                  Clear
                </button>

                <button
                  type="button"
                  onClick={handleSignAgreement}
                  disabled={signing}
                  className="inline-flex items-center gap-2 rounded-[8px] bg-[#4C78F5] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[#3B66E0] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {signing ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Signing…
                    </>
                  ) : (
                    "Sign Agreement"
                  )}
                </button>
              </div>
            </>
          )}

          <p className="mt-3 text-[12px] text-[#64748B]">
            Signed at:{" "}
            <span className="font-medium text-[#111827]">
              {data.signedAt
                ? new Date(data.signedAt).toLocaleString()
                : "Pending"}
            </span>
          </p>
        </div>
      </FeeAgreementDocument>
    </div>
  );
}
