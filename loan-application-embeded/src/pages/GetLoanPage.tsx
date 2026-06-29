import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import LoanApplication from "../pages/LoanApplication/LoanApplication";

export default function GetLoanPage() {
  const [searchParams] = useSearchParams();
  const [submitted, setSubmitted] = useState(false);

  const brokerOrgId = useMemo(() => {
    const broker = searchParams.get("broker")?.trim();
    return broker || null;
  }, [searchParams]);

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">
            Application Submitted
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Thank you. Your loan application has been received. A broker will
            review it and contact you with next steps.
          </p>
          <button
            type="button"
            onClick={() => setSubmitted(false)}
            className="mt-6 rounded-lg bg-[#2C92D5] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#19679b]"
          >
            Submit Another Application
          </button>
        </div>
      </div>
    );
  }

  if (!brokerOrgId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
        <div className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">
            Invalid Application Link
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            This page requires a valid broker link. Please use the link your
            broker sent you, or contact them for a new one.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-6xl">
        <LoanApplication
          embedded
          publicEmbed
          brokerOrgId={brokerOrgId}
          onPublicSubmitSuccess={() => setSubmitted(true)}
        />
      </div>
    </div>
  );
}
