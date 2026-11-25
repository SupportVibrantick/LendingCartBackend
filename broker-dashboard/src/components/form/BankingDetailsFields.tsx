import type { BankingFormErrors, BankingFormState } from "../../lib/bankingForm";
import { formatBankingPhone } from "../../lib/bankingForm";

const inputClass =
  "h-10 w-full rounded-xl border border-border bg-white px-3.5 text-sm text-text-primary outline-none transition placeholder:text-text-secondary/70 focus:border-[#4C78F5]/50 focus:ring-2 focus:ring-[#4C78F5]/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-[0.06em] text-text-secondary";

function Field({
  label,
  required,
  error,
  field,
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  error?: string;
  field?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className} data-field={field || undefined}>
      <label className={labelClass}>
        {label}
        {required ? <span className="text-rose-500"> *</span> : null}
      </label>
      {children}
      {error ? <p className="mt-1 text-xs text-rose-500">{error}</p> : null}
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
    <div className="space-y-5">
      <div data-field="accountType">
        <p className={labelClass}>
          Account type <span className="text-rose-500">*</span>
        </p>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
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
                    ? "border-[#4C78F5] bg-[#4C78F5]/5 ring-1 ring-[#4C78F5]/25"
                    : "border-border bg-white hover:border-[#4C78F5]/30 hover:bg-surface dark:border-slate-700 dark:bg-slate-950"
                }`}
              >
                <span
                  className={`block text-sm font-semibold ${
                    selected
                      ? "text-[#4C78F5]"
                      : "text-text-primary dark:text-slate-100"
                  }`}
                >
                  {option.label}
                </span>
                <span className="mt-0.5 block text-xs text-text-secondary">
                  {option.hint}
                </span>
              </button>
            );
          })}
        </div>
        {errors.accountType ? (
          <p className="mt-1 text-xs text-rose-500">{errors.accountType}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Field
          label={isBusiness ? "Business Name" : `${personalLabel} Name`}
          required
          field="partyName"
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
          field="partyAddress"
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
          field="partyTel"
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
          field="partyEmail"
          error={errors.partyEmail}
        >
          <input
            type="email"
            className={inputClass}
            value={value.partyEmail}
            onChange={(e) => onChange("partyEmail", e.target.value)}
          />
        </Field>
        <Field
          label="Bank Name"
          required
          field="bankName"
          error={errors.bankName}
        >
          <input
            className={inputClass}
            value={value.bankName}
            onChange={(e) => onChange("bankName", e.target.value)}
          />
        </Field>
        <Field
          label="Bank Tel#"
          required
          field="bankTel"
          error={errors.bankTel}
        >
          <input
            className={inputClass}
            value={value.bankTel}
            onChange={(e) =>
              onChange("bankTel", formatBankingPhone(e.target.value))
            }
            placeholder="555-555-5555"
          />
        </Field>
        <Field
          label="Account Name"
          required
          field="accountName"
          error={errors.accountName}
        >
          <input
            className={inputClass}
            value={value.accountName}
            onChange={(e) => onChange("accountName", e.target.value)}
          />
        </Field>
        <Field
          label="Account Number"
          required
          field="accountNumber"
          error={errors.accountNumber}
        >
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
          field="abaRoutingNumber"
          error={errors.abaRoutingNumber}
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
      <p className="text-xs text-text-secondary">
        Used for commission ACH payouts after a deal funds. Keep these details
        accurate.
      </p>
    </div>
  );
}
