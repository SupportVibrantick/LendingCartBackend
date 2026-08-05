import { Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  buildApplicationDetailsPdfFilename,
  downloadApplicationDetailsPdf,
  fetchBrokerBrandingForPdf,
  getBrokerProfileForPdf,
  type BrokerPdfBranding,
} from "../../lib/applicationDetailsPdf";
import {
  getNumericFieldValue,
  PRODUCT_LABELS,
  type SubmissionDetailField,
} from "../../lib/submissionFieldUtils";
import ApplicationDetailsPdfTemplate from "./ApplicationDetailsPdfTemplate";

type ApplicationDetailsDownloadButtonProps = {
  submissionDetail: {
    applicationNumber?: string | null;
    status?: string | null;
    borrowerName?: string | null;
    submissionId?: string | null;
    loanProduct?: { name?: string | null } | null;
  } | null;
  fields: SubmissionDetailField[];
  formatSubmissionStatus: (status?: string) => string;
  formatCompactAmount: (value: number) => string;
  loanAmount: number;
  ltv: number;
  dscr: number;
  monthlyPaymentDisplay?: string;
  monthlyPayment?: number;
  submittedDate?: Date | null;
  className?: string;
};

export default function ApplicationDetailsDownloadButton({
  submissionDetail,
  fields,
  formatSubmissionStatus,
  formatCompactAmount,
  loanAmount,
  ltv,
  dscr,
  monthlyPaymentDisplay,
  monthlyPayment = 0,
  submittedDate,
  className = "",
}: ApplicationDetailsDownloadButtonProps) {
  const pdfRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [branding, setBranding] = useState<BrokerPdfBranding | null>(null);

  const brokerProfile = getBrokerProfileForPdf();

  useEffect(() => {
    fetchBrokerBrandingForPdf().then(setBranding);
  }, []);

  const interestRate = getNumericFieldValue(fields, "interestRate");
  const amortizationYears = getNumericFieldValue(fields, "amortization");
  const loanTermMonths = getNumericFieldValue(fields, "loanTerm");

  const amortizationLabel =
    amortizationYears > 0
      ? `${amortizationYears} yr${amortizationYears === 1 ? "" : "s"}`
      : loanTermMonths > 0
        ? `${Math.round(loanTermMonths / 12)} yrs (${loanTermMonths} mo)`
        : "—";

  const resolvedMonthlyPaymentDisplay =
    monthlyPaymentDisplay ||
    (monthlyPayment > 0
      ? `$${monthlyPayment.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : "—");

  const loanProductField = fields.find(
    (field) => field.fieldKey === "loanProductCode",
  );
  const loanProductCode = loanProductField?.value || "";
  const loanProductName =
    submissionDetail?.loanProduct?.name ||
    PRODUCT_LABELS[String(loanProductCode)] ||
    String(loanProductCode).replace(/_/g, " ") ||
    "—";

  const handleDownload = async () => {
    try {
      setDownloading(true);

      const latestBranding = await fetchBrokerBrandingForPdf();
      setBranding(latestBranding);

      await new Promise((resolve) => window.setTimeout(resolve, 100));

      await downloadApplicationDetailsPdf({
        element: pdfRef.current,
        filename: buildApplicationDetailsPdfFilename({
          applicationNumber: submissionDetail?.applicationNumber,
          borrowerName: submissionDetail?.borrowerName,
          submissionId: submissionDetail?.submissionId,
        }),
      });

      toast.success("Application PDF downloaded");
    } catch {
      toast.error("Failed to generate PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  if (!branding) {
    return (
      <button
        type="button"
        disabled
        className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-400 ${className}`}
      >
        <Download size={13} />
        <span className="hidden sm:inline">Loading...</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        title="Download Application PDF"
        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#13538A]/20 bg-[#13538A]/5 px-3 py-1.5 text-xs font-semibold text-[#13538A] transition hover:bg-[#13538A]/10 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      >
        <Download size={13} />
        <span className="hidden sm:inline">
          {downloading ? "Preparing..." : "Download PDF"}
        </span>
      </button>

      <div
        ref={pdfRef}
        aria-hidden
        style={{
          position: "fixed",
          left: "-12000px",
          top: 0,
          pointerEvents: "none",
        }}
      >
        <ApplicationDetailsPdfTemplate
          submissionDetail={submissionDetail}
          fields={fields}
          formatSubmissionStatus={formatSubmissionStatus}
          formatCompactAmount={formatCompactAmount}
          loanAmount={loanAmount}
          ltv={ltv}
          dscr={dscr}
          interestRate={interestRate}
          amortizationLabel={amortizationLabel}
          monthlyPaymentDisplay={resolvedMonthlyPaymentDisplay}
          submittedDate={submittedDate}
          brokerProfile={brokerProfile}
          loanProductName={loanProductName}
          branding={branding}
        />
      </div>
    </>
  );
}
