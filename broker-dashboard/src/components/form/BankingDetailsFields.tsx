import type { BankingFormErrors, BankingFormState } from "../../lib/bankingForm";
import { formatBankingPhone } from "../../lib/bankingForm";

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-[#13538A]/40 focus:bg-white focus:ring-2 focus:ring-[#13538A]/10 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100";

const labelClass =
  "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";

function Field({
  label,
  required,
  error,
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className={labelClass}>
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      {children}
      {error ? <p className="mt-1 text-xs text-red-500">{error}</p> : null}
    </div>
  );
}

type Props = {
  value: BankingFormState;
  errors?: BankingFormErrors;
  onChange: <K extends keyof BankingFormState>(
    key: K,
    next: BankingFormState[K],
  ) => void;
};

export default function BankingDetailsFields({
  value,
  errors = {},
  onChange,
}: Props) {
  const personalLabel = "Personal";
  const isBusiness = value.accountType === "BUSINESS";

  return (
    <div className="space-y-4">
      <div>
        <p className={labelClass}>
          Account type <span className="text-red-500">*</span>
        </p>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              {
                type: "PERSONAL" as const,
                label: "Personal Account",
                hint: "Individual banking profile",
              },
              {
                type: "BUSINESS" as const,
                label: "Business Account",
                hint: "Company banking profile",
              },
            ] as const
          ).map((option) => {
            const selected = value.accountType === option.type;
            return (
              <button
                key={option.type}
                type="button"
                onClick={() => onChange("accountType", option.type)}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  selected
                    ? "border-[#13538A] bg-[#13538A]/5 ring-1 ring-[#13538A]/30 dark:border-cyan-400 dark:bg-cyan-500/10"
                    : "border-gray-200 bg-gray-50 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-950"
                }`}
              >
                <span
                  className={`block text-sm font-semibold ${
                    selected
                      ? "text-[#13538A] dark:text-cyan-300"
                      : "text-gray-800 dark:text-gray-200"
                  }`}
                >
                  {option.label}
                </span>
                <span className="mt-0.5 block text-xs text-gray-500">
                  {option.hint}
                </span>
              </button>
            );
          })}
        </div>
        {errors.accountType ? (
          <p className="mt-1 text-xs text-red-500">{errors.accountType}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label={isBusiness ? "Business Name" : `${personalLabel} Name`}
          required
          error={errors.partyName}
        >
          <input
            className={inputClass}
            value={value.partyName}
            onChange={(e) => onChange("partyName", e.target.value)}
          />
        </Field>
        <Field
          label={isBusiness ? "Business Address" : `${personalLabel} Address`}
          required
          error={errors.partyAddress}
        >
          <input
            className={inputClass}
            value={value.partyAddress}
            onChange={(e) => onChange("partyAddress", e.target.value)}
          />
        </Field>
        <Field
          label={isBusiness ? "Business Tel#" : `${personalLabel} Tel#`}
          required
          error={errors.partyTel}
        >
          <input
            className={inputClass}
            value={value.partyTel}
            onChange={(e) =>
              onChange("partyTel", formatBankingPhone(e.target.value))
            }
            placeholder="555-555-5555"
          />
        </Field>
        <Field
          label={isBusiness ? "Business Email" : `${personalLabel} Email`}
          required
          error={errors.partyEmail}
        >
          <input
            type="email"
            className={inputClass}
            value={value.partyEmail}
            onChange={(e) => onChange("partyEmail", e.target.value)}
          />
        </Field>
        <Field label="Bank Name" required error={errors.bankName}>
          <input
            className={inputClass}
            value={value.bankName}
            onChange={(e) => onChange("bankName", e.target.value)}
          />
        </Field>
        <Field label="Bank Tel#" required error={errors.bankTel}>
          <input
            className={inputClass}
            value={value.bankTel}
            onChange={(e) =>
              onChange("bankTel", formatBankingPhone(e.target.value))
            }
            placeholder="555-555-5555"
          />
        </Field>
        <Field label="Account Name" required error={errors.accountName}>
          <input
            className={inputClass}
            value={value.accountName}
            onChange={(e) => onChange("accountName", e.target.value)}
          />
        </Field>
        <Field label="Account Number" required error={errors.accountNumber}>
          <input
            className={inputClass}
            inputMode="numeric"
            value={value.accountNumber}
            onChange={(e) =>
              onChange(
                "accountNumber",
                e.target.value.replace(/\D/g, "").slice(0, 17),
              )
            }
          />
        </Field>
        <Field
          label="ABA / Routing Number"
          required
          error={errors.abaRoutingNumber}
          className="sm:col-span-2"
        >
          <input
            className={inputClass}
            inputMode="numeric"
            value={value.abaRoutingNumber}
            onChange={(e) =>
              onChange(
                "abaRoutingNumber",
                e.target.value.replace(/\D/g, "").slice(0, 9),
              )
            }
            placeholder="9 digits"
          />
        </Field>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Used for commission ACH payouts after a deal funds. Keep these details
        accurate.
      </p>
    </div>
  );
}
