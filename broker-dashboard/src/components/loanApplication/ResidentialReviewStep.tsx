import { useState, type ReactNode } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Pencil,
  Send,
  ShieldCheck,
} from "lucide-react";
import type { PendingApplicationDocument } from "../../lib/applicationDocumentTypes";
import type {
  ReviewSummarySection,
  ReviewValidationIssue,
} from "../../lib/residentialReviewHelpers";

type ResidentialReviewStepProps = {
  sections: ReviewSummarySection[];
  issues: ReviewValidationIssue[];
  documents: PendingApplicationDocument[];
  onEditStep: (stepIndex: number, issue?: ReviewValidationIssue) => void;
  onSubmit: () => void;
  submitting: boolean;
  captchaSlot?: ReactNode;
  requireCaptcha?: boolean;
  captchaVerified?: boolean;
  creditAuthorizationConsent?: boolean;
  onCreditAuthorizationConsentChange?: (agreed: boolean) => void;
};

const CREDIT_AUTHORIZATION_CONSENT_TEXT =
  "By signing this Loan Application, I/We authorize the Broker, Lender, and their authorized representatives to obtain, verify, and exchange my/our personal, financial, employment, and credit information, including obtaining consumer and/or commercial credit reports, for the purpose of evaluating, processing, underwriting, and administering this loan application. I/We certify that all information provided is true and complete to the best of my/our knowledge.";

const ReviewAccordion = ({
  section,
  documents,
  onEdit,
  defaultOpen = false,
}: {
  section: ReviewSummarySection;
  documents: PendingApplicationDocument[];
  onEdit: () => void;
  defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
              open
                ? "bg-[#4C78F5]/10 text-[#4C78F5]"
                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
            }`}
          >
            {open ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </span>
          <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
            <span className="mr-1.5 text-[#4C78F5]">{section.stepIndex + 1}</span>
            {section.title}
          </span>
        </button>

        <button
          type="button"
          onClick={onEdit}
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-[#4C78F5] transition hover:bg-[#4C78F5]/[0.06] dark:border-slate-700 dark:bg-slate-950"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-100 px-3.5 py-3.5 dark:border-slate-800">
          {section.rows.length > 0 && (
            <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
              {section.rows.map((row) => (
                <div key={row.label} className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    {row.label}
                  </p>
                  <p className="mt-0.5 truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                    {row.value}
                  </p>
                </div>
              ))}
            </div>
          )}

          {section.extraContent === "documents" && documents.length > 0 && (
            <div className="mb-2 space-y-1.5">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300"
                >
                  <FileText className="h-4 w-4 shrink-0 text-[#4C78F5]" />
                  <span className="min-w-0 truncate">
                    {doc.fileName}{" "}
                    <span className="text-slate-500">
                      ({doc.documentType || "other"})
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}

          {section.title === "Documents & Signature" && (
            <div className="mt-2 rounded-xl border border-[#4C78F5]/20 bg-[#4C78F5]/[0.06] p-3.5">
              <div className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#4C78F5] text-white">
                  <FileText className="h-4 w-4" />
                </span>
                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    Broker Notice:
                  </span>{" "}
                  The signature section has been removed from this form. Brokers
                  and Loan Officers cannot sign on behalf of clients. Once you
                  submit this application, the client will automatically receive
                  an email with a link to their Client Portal where they can
                  review, accept the terms &amp; conditions, and sign the
                  application digitally.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function ResidentialReviewStep({
  sections,
  issues,
  documents,
  onEditStep,
  onSubmit,
  submitting,
  captchaSlot = null,
  requireCaptcha = false,
  captchaVerified = false,
  creditAuthorizationConsent,
  onCreditAuthorizationConsentChange,
}: ResidentialReviewStepProps) {
  const [localConsent, setLocalConsent] = useState(false);
  const consentAgreed =
    creditAuthorizationConsent !== undefined
      ? creditAuthorizationConsent
      : localConsent;

  const setConsentAgreed = (agreed: boolean) => {
    if (onCreditAuthorizationConsentChange) {
      onCreditAuthorizationConsentChange(agreed);
      return;
    }
    setLocalConsent(agreed);
  };

  const canSubmit =
    issues.length === 0 &&
    consentAgreed &&
    (!requireCaptcha || captchaVerified);

  const helperMessage =
    issues.length > 0
      ? "Please complete all required fields to enable submission."
      : !consentAgreed
        ? "Please agree to the Credit Authorization Consent to enable submission."
        : requireCaptcha && !captchaVerified
          ? "Please complete the reCAPTCHA verification to enable submission."
          : null;

  return (
    <div className="mt-1 space-y-4 font-[Inter,system-ui,sans-serif]">
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-3 dark:border-slate-700 dark:bg-slate-900/40">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">
          Review your application
        </p>
        <p className="mt-0.5 text-sm text-slate-500">
          Check each section carefully before submitting. Use{" "}
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            Edit
          </span>{" "}
          to jump back and make changes.
        </p>
      </div>

      {issues.length > 0 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 dark:border-rose-900/40 dark:bg-rose-900/20">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
                Please complete the following required fields
              </p>
              <ul className="mt-2 space-y-1.5">
                {issues.map((issue) => (
                  <li
                    key={`${issue.errorKey || issue.label}-${issue.stepIndex}`}
                    className="flex flex-wrap items-center gap-2 text-sm text-rose-700 dark:text-rose-300"
                  >
                    <span>• {issue.label}</span>
                    <button
                      type="button"
                      onClick={() => onEditStep(issue.stepIndex, issue)}
                      className="font-semibold text-[#4C78F5] underline-offset-2 hover:underline"
                    >
                      Go to Step {issue.stepIndex + 1}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2.5">
        {sections.map((section, index) => (
          <ReviewAccordion
            key={section.title}
            section={section}
            documents={documents}
            onEdit={() => onEditStep(section.stepIndex)}
            defaultOpen={index === 0}
          />
        ))}
      </div>

      <div
        className={`overflow-hidden rounded-2xl border bg-white dark:bg-slate-950 ${
          consentAgreed
            ? "border-emerald-200 dark:border-emerald-800/60"
            : "border-slate-200 dark:border-slate-700"
        }`}
      >
        <div className="flex items-center gap-2.5 border-b border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/50">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-lg ${
              consentAgreed
                ? "bg-emerald-500 text-white"
                : "bg-[#4C78F5]/10 text-[#4C78F5]"
            }`}
          >
            {consentAgreed ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#4C78F5]">
              Required
            </p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              Credit Authorization Consent
            </p>
          </div>
        </div>

        <div className="px-4 py-3.5">
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {CREDIT_AUTHORIZATION_CONSENT_TEXT}
          </p>

          <label
            className={`mt-3.5 flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition ${
              consentAgreed
                ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-800/50 dark:bg-emerald-950/20"
                : "border-slate-200 bg-slate-50/80 hover:border-[#4C78F5]/35 dark:border-slate-700 dark:bg-slate-900/40"
            }`}
          >
            <input
              type="checkbox"
              checked={consentAgreed}
              onChange={(e) => setConsentAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-[#4C78F5] focus:ring-2 focus:ring-[#4C78F5]/30"
            />
            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
              I/We agree to the Credit Authorization Consent above.{" "}
              <span className="text-rose-500">*</span>
            </span>
          </label>
        </div>
      </div>

      {captchaSlot ? <div className="flex justify-center">{captchaSlot}</div> : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-950">
        {helperMessage ? (
          <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-800/50 dark:bg-amber-950/20">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              {helperMessage}
            </p>
          </div>
        ) : (
          <div className="mb-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-800/50 dark:bg-emerald-950/20">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <p className="text-sm text-emerald-800 dark:text-emerald-200">
              All required items are complete. You can submit this application.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit || submitting}
          className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition ${
            canSubmit && !submitting
              ? "bg-[#4C78F5] text-white hover:bg-[#3B66E0]"
              : "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500"
          }`}
        >
          <Send className="h-4 w-4" />
          {submitting ? "Submitting..." : "Submit Application"}
        </button>
      </div>
    </div>
  );
}
