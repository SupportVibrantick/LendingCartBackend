import { Download } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import toast from "react-hot-toast";
import {
  buildApplicationDetailsPdfFilename,
  downloadApplicationDetailsPdf,
  fetchLenderBrandingForPdf,
  getBrokerProfileFromApplication,
  type PdfBranding,
} from "../../lib/applicationDetailsPdf";
import {
  formatLoanProduct,
  formatCompactAmount,
} from "../../lib/loanPipelineUtils";
import {
  getBorrowerDisplayNameFromFields,
  getNumericFieldValue,
  type SubmissionDetailField,
} from "../../lib/submissionFieldUtils";
import ApplicationDetailsPdfTemplate from "./ApplicationDetailsPdfTemplate";

type LenderApplicationDetailsDownloadButtonProps = {
  applicationLender: any;
  fields: SubmissionDetailField[];
  formatApplicationStatus: (status?: string) => string;
  loanAmount: number;
  ltv: number;
  dscr: number;
  monthlyPaymentDisplay?: string;
  monthlyPayment?: number;
  submittedDate?: Date | null;
  className?: string;
  initialBranding?: PdfBranding | null;
};

export default function LenderApplicationDetailsDownloadButton({
  applicationLender,
  fields,
  formatApplicationStatus,
  loanAmount,
  ltv,
  dscr,
  monthlyPaymentDisplay,
  monthlyPayment = 0,
  submittedDate,
  className = "",
  initialBranding = null,
}: LenderApplicationDetailsDownloadButtonProps) {
  const pdfRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [branding, setBranding] = useState<PdfBranding>(
    initialBranding || {
      brandName: "LendingCart",
      logoUrl: null,
      primaryColor: "#4C78F5",
      secondaryColor: "#2C92D5",
    },
  );

  const brokerProfile = useMemo(
    () => getBrokerProfileFromApplication(applicationLender),
    [applicationLender],
  );

  useEffect(() => {
    if (initialBranding) {
      setBranding(initialBranding);
    }
  }, [initialBranding]);

  const loanApplication = applicationLender?.loanApplication;

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

  const loanProductName =
    applicationLender?.loanProduct?.name ||
    formatLoanProduct(loanApplication?.loanProductCode) ||
    "—";

  const submissionDetail = {
    applicationNumber: loanApplication?.applicationNumber,
    status: applicationLender?.status || loanApplication?.status,
    borrowerName:
      applicationLender?.borrowerName || loanApplication?.client?.legalName,
    submissionId: applicationLender?.latestSubmission?.id,
    loanProduct: applicationLender?.loanProduct,
  };

  const handleDownload = async () => {
    if (!pdfRef.current) {
      toast.error("PDF content is not ready yet. Please try again.");
      return;
    }

    try {
      setDownloading(true);

      const latestBranding = await fetchLenderBrandingForPdf();
      flushSync(() => {
        setBranding(latestBranding);
      });

      await new Promise((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(resolve);
        });
      });

      await downloadApplicationDetailsPdf({
        element: pdfRef.current,
        filename: buildApplicationDetailsPdfFilename({
          applicationNumber: submissionDetail.applicationNumber,
          borrowerName: getBorrowerDisplayNameFromFields(
            fields,
            submissionDetail.borrowerName,
          ),
          submissionId: submissionDetail.submissionId,
        }),
      });

      toast.success("Application PDF downloaded");
    } catch (error) {
      console.error("Application PDF export failed:", error);
      toast.error("Failed to generate PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        title="Download Application PDF"
        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#4C78F5]/20 bg-[#4C78F5]/5 px-3 py-1.5 text-xs font-semibold text-[#4C78F5] transition hover:bg-[#4C78F5]/10 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
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
          formatSubmissionStatus={formatApplicationStatus}
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
