import { Download } from "lucide-react";
import { useState, type RefObject } from "react";
import toast from "react-hot-toast";
import { isFeeAgreementSigned } from "../lib/feeAgreementDisplayUtils";
import {
  buildFeeAgreementPdfFilename,
  downloadFeeAgreementPdf,
} from "../lib/feeAgreementPdf";

type Props = {
  data: {
    status?: string | null;
    clientSignature?: string | null;
    signedAt?: string | null;
    clientName?: string | null;
    clientEntityName?: string | null;
    id?: string;
    loanApplicationId?: string;
    agreementHtml?: string | null;
  };
  pdfRef: RefObject<HTMLDivElement | null>;
  downloadUrl?: string;
  getAuthHeaders?: () => HeadersInit;
  className?: string;
};

export default function FeeAgreementDownloadButton({
  data,
  pdfRef,
  downloadUrl,
  getAuthHeaders,
  className = "",
}: Props) {
  const [downloading, setDownloading] = useState(false);

  if (!isFeeAgreementSigned(data)) {
    return null;
  }

  const handleDownload = async () => {
    try {
      setDownloading(true);

      await downloadFeeAgreementPdf({
        agreementHtml: data.agreementHtml,
        element: pdfRef.current,
        filename: buildFeeAgreementPdfFilename(data),
        downloadUrl,
        getAuthHeaders,
      });

      toast.success("Fee agreement downloaded");
    } catch {
      toast.error("Failed to generate PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={downloading}
      className={`flex items-center gap-2 px-4 py-2 text-xs rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900 ${className}`}
    >
      <Download size={14} />
      {downloading ? "Preparing PDF..." : "Download PDF"}
    </button>
  );
}
