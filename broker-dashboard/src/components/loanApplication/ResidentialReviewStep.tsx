import { useState, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronUp,
  FileText,
  Pencil,
  Send,
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
  onEditStep: (stepIndex: number) => void;
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
    <div className="rounded-lg border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="flex flex-1 items-center gap-2 text-left"
        >
          {open ? (
            <ChevronUp className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          )}
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {section.stepIndex + 1} · {section.title}
          </span>
        </button>

        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[#2C92D5] hover:bg-[#2C92D5]/10"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-200 px-4 py-4 dark:border-slate-700">
          {section.rows.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {section.rows.map((row) => (
                <div key={row.label} className="min-w-0">
                  <p className="text-xs text-slate-500">{row.label}</p>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    {row.value}
                  </p>
                </div>
              ))}
            </div>
          )}

          {section.extraContent === "documents" && documents.length > 0 && (
            <div className="mb-3 space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"
                >
                  <FileText className="h-4 w-4 text-slate-400" />
                  <span>
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
            <div className="mt-3 rounded-lg border border-[#2C92D5]/20 bg-[#2C92D5]/5 p-4">
              <div className="flex gap-3">
                <FileText className="mt-0.5 h-5 w-5 shrink-0 text-[#2C92D5]" />
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  <span className="font-semibold">Broker Notice:</span> The
                  signature section has been removed from this form. Brokers and
                  Loan Officers cannot sign on behalf of clients. Once you submit
                  this application, the client will automatically receive an
                  email with a link to their Client Portal where they can review,
                  accept the terms &amp; conditions, and sign the application
                  digitally.
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

  return (
    <div className="mt-5 space-y-5">
      <div>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Review Your Application
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Please review all sections carefully before submitting. Click{" "}
          <span className="font-medium text-slate-700 dark:text-slate-300">
            Edit
          </span>{" "}
          on any section to make changes.
        </p>
      </div>

      {issues.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-900/20">
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">
            Please complete the following required fields:
          </p>
          <ul className="mt-2 space-y-1">
            {issues.map((issue) => (
              <li
                key={`${issue.label}-${issue.stepIndex}`}
                className="flex flex-wrap items-center gap-2 text-sm text-red-700 dark:text-red-400"
              >
                <span>• {issue.label}</span>
                <button
                  type="button"
                  onClick={() => onEditStep(issue.stepIndex)}
                  className="font-medium underline hover:no-underline"
                >
                  Go to Step {issue.stepIndex + 1}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-3">
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

      <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/40">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Credit Authorization Consent
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {CREDIT_AUTHORIZATION_CONSENT_TEXT}
        </p>
        <label className="mt-4 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={consentAgreed}
            onChange={(e) => setConsentAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-[#2C92D5] focus:ring-[#2C92D5]"
          />
          <span className="text-sm text-slate-700 dark:text-slate-300">
            I/We agree to the Credit Authorization Consent above.{" "}
            <span className="text-red-500">*</span>
          </span>
        </label>
      </div>

      {!canSubmit && issues.length > 0 && (
        <p className="text-center text-sm text-slate-500">
          Please complete all required fields to enable submission.
        </p>
      )}

      {!canSubmit &&
        issues.length === 0 &&
        !consentAgreed && (
          <p className="text-center text-sm text-slate-500">
            Please agree to the Credit Authorization Consent to enable
            submission.
          </p>
        )}

      {!canSubmit &&
        issues.length === 0 &&
        consentAgreed &&
        requireCaptcha &&
        !captchaVerified && (
          <p className="text-center text-sm text-slate-500">
            Please complete the reCAPTCHA verification to enable submission.
          </p>
        )}

      {captchaSlot}

      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit || submitting}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#2C92D5] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#19679b] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-700"
      >
        <Send className="h-4 w-4" />
        {submitting ? "Submitting..." : "Submit Application"}
      </button>
    </div>
  );
}
