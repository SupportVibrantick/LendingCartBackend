import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import ReCAPTCHA from "react-google-recaptcha";
import LoanApplication from "../pages/LoanApplication/LoanApplication";

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

export default function GetLoanPage() {
  const [submitted, setSubmitted] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);

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
            onClick={() => {
              setSubmitted(false);
              setRecaptchaToken(null);
            }}
            className="mt-6 rounded-lg bg-[#2C92D5] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#19679b]"
          >
            Submit Another Application
          </button>
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
          recaptchaToken={recaptchaToken}
          onPublicSubmitSuccess={() => setSubmitted(true)}
          reviewCaptchaSlot={
            RECAPTCHA_SITE_KEY ? (
              <div className="flex justify-center">
                <ReCAPTCHA
                  sitekey={RECAPTCHA_SITE_KEY}
                  onChange={(token) => setRecaptchaToken(token)}
                  onExpired={() => setRecaptchaToken(null)}
                />
              </div>
            ) : null
          }
        />
      </div>
    </div>
  );
}
