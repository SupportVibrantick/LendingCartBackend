import { Receipt } from "lucide-react";
import { validateFeeAgreementForm } from "../../lib/feeAgreementDisplayUtils";

export type FeeAgreementDraft = {
  include: boolean;
  brokerPoints: string;
  upfrontFee: string;
  exclusivityMonths: string;
};

export const EMPTY_FEE_AGREEMENT_DRAFT: FeeAgreementDraft = {
  include: false,
  brokerPoints: "",
  upfrontFee: "",
  exclusivityMonths: "",
};

type LoanApplicationFeeAgreementStepProps = {
  draft: FeeAgreementDraft;
  errors: Record<string, string>;
  onChange: (draft: FeeAgreementDraft) => void;
  stepNumber: number;
};

export function validateOptionalFeeAgreementDraft(
  draft: FeeAgreementDraft,
): Record<string, string> {
  if (!draft.include) return {};

  const result = validateFeeAgreementForm({
    brokerPoints: draft.brokerPoints,
    upfrontFee: draft.upfrontFee,
    exclusivityMonths: draft.exclusivityMonths,
  });

  const errors: Record<string, string> = {};
  if (result.brokerPoints) {
    errors["feeAgreement.brokerPoints"] = result.brokerPoints;
  }
  if (result.upfrontFee) {
    errors["feeAgreement.upfrontFee"] = result.upfrontFee;
  }
  if (result.exclusivityMonths) {
    errors["feeAgreement.exclusivityMonths"] = result.exclusivityMonths;
  }
  return errors;
}

export default function LoanApplicationFeeAgreementStep({
  draft,
  errors,
  onChange,
  stepNumber,
}: LoanApplicationFeeAgreementStepProps) {
  return (
    <div className="mt-6 relative z-10 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
      <h3 className="mb-1 inline-block border-b-2 border-[#2C92D5] pb-2 text-lg font-semibold dark:text-white">
        Step {stepNumber}: Fee Agreement
      </h3>
      <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
        Optional. If you include a fee agreement now, it will be available in
        the client portal when this application is submitted.
      </p>

      <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
        <input
          type="checkbox"
          checked={draft.include}
          onChange={(event) =>
            onChange({ ...draft, include: event.target.checked })
          }
          className="mt-1 h-4 w-4 rounded border-slate-300 text-[#2C92D5]"
        />
        <span>
          <span className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
            <Receipt size={16} />
            Include a fee agreement for this application
          </span>
          <span className="mt-1 block text-xs text-slate-500">
            Leave unchecked to skip. You can still add or update a fee
            agreement later from the submitted application.
          </span>
        </span>
      </label>

      {draft.include && (
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
              Broker Points (%){" "}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={draft.brokerPoints}
              onChange={(event) =>
                onChange({ ...draft, brokerPoints: event.target.value })
              }
              placeholder="e.g. 1.0"
              className={`w-full rounded-md border px-4 py-2 text-sm outline-none dark:bg-slate-900 dark:text-slate-200 ${
                errors["feeAgreement.brokerPoints"]
                  ? "border-red-500 bg-red-50"
                  : "border-slate-300 dark:border-slate-600"
              }`}
            />
            {errors["feeAgreement.brokerPoints"] && (
              <p className="mt-1 text-xs text-red-500">
                {errors["feeAgreement.brokerPoints"]}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
              Upfront Fee ($)
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={draft.upfrontFee}
              onChange={(event) =>
                onChange({ ...draft, upfrontFee: event.target.value })
              }
              placeholder="e.g. 2500"
              className={`w-full rounded-md border px-4 py-2 text-sm outline-none dark:bg-slate-900 dark:text-slate-200 ${
                errors["feeAgreement.upfrontFee"]
                  ? "border-red-500 bg-red-50"
                  : "border-slate-300 dark:border-slate-600"
              }`}
            />
            {errors["feeAgreement.upfrontFee"] && (
              <p className="mt-1 text-xs text-red-500">
                {errors["feeAgreement.upfrontFee"]}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
              Exclusivity (Months)
            </label>
            <input
              type="number"
              min={0}
              step="1"
              value={draft.exclusivityMonths}
              onChange={(event) =>
                onChange({ ...draft, exclusivityMonths: event.target.value })
              }
              placeholder="e.g. 6"
              className={`w-full rounded-md border px-4 py-2 text-sm outline-none dark:bg-slate-900 dark:text-slate-200 ${
                errors["feeAgreement.exclusivityMonths"]
                  ? "border-red-500 bg-red-50"
                  : "border-slate-300 dark:border-slate-600"
              }`}
            />
            {errors["feeAgreement.exclusivityMonths"] && (
              <p className="mt-1 text-xs text-red-500">
                {errors["feeAgreement.exclusivityMonths"]}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
