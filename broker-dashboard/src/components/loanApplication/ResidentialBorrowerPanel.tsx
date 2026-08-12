import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Plus } from "lucide-react";
import { MdDeleteForever } from "react-icons/md";
import LoanDateField from "../form/LoanDateField";
import {
  ASSET_FIELD_DEFS,
  createEmptyAssets,
  createEmptyDeclarations,
  createEmptyLiabilities,
  countUnansweredDeclarations,
  DECLARATION_QUESTIONS,
  isDeclarationAnswered,
  LEGAL_STATUS_OPTIONS,
  LIABILITY_FIELD_DEFS,
  type BorrowerAssets,
  type BorrowerDeclarations,
  type BorrowerLiabilities,
  type RealEstateOwnedEntry,
  type ResidentialBorrowerFields,
  type YesNo,
  sumBorrowerAssets,
  sumBorrowerLiabilities,
  sumScheduleMarketValue,
  formatCurrencyInput,
} from "../../lib/residentialBorrower";

type BorrowerPanelData = ResidentialBorrowerFields & {
  phone: string;
  email: string;
  ssn: string;
  creditScore: string;
};

export type ResidentialBorrowerPanelProps = {
  borrowerIndex: number;
  isPrimary: boolean;
  borrower: BorrowerPanelData;
  errors: Record<string, string>;
  errorPrefix: string;
  formatUSPhone: (value: string) => string;
  formatSSN: (value: string) => string;
  onFieldChange: (field: keyof BorrowerPanelData, value: string) => void;
  onAssetChange: (field: keyof BorrowerAssets, value: string) => void;
  onLiabilityChange: (field: keyof BorrowerLiabilities, value: string) => void;
  onDeclarationChange: (
    field: keyof BorrowerDeclarations,
    value: YesNo,
  ) => void;
  onAddProperty: () => void;
  onRemoveProperty: (propertyId: number) => void;
  onPropertyChange: (
    propertyId: number,
    field: keyof RealEstateOwnedEntry,
    value: string,
  ) => void;
  onRemove?: () => void;
  onAmountChange: (field: string, value: string) => void;
};

const inputClass = (hasError: boolean) =>
  `mt-1 w-full rounded-md border px-4 py-1 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${
    hasError ? "border-red-500 bg-red-50" : "border-slate-300"
  }`;

const currencyInputClass = (hasError: boolean) =>
  `w-full rounded-md border py-1 pl-7 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${
    hasError ? "border-red-500 bg-red-50" : "border-slate-300"
  }`;

const CollapsibleSection = ({
  title,
  children,
  defaultOpen = false,
  highlighted = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  highlighted?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={`mt-4 rounded-lg border ${
        highlighted
          ? "border-amber-300 bg-amber-50/70 dark:border-amber-700 dark:bg-amber-950/20"
          : "border-slate-200 dark:border-slate-700"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold ${
          highlighted
            ? "text-amber-900 dark:text-amber-100"
            : "text-slate-800 dark:text-slate-100"
        }`}
      >
        {title}
        {open ? (
          <ChevronUp className="h-4 w-4 text-slate-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-500" />
        )}
      </button>
      {open && (
        <div
          className={`border-t px-4 py-4 ${
            highlighted
              ? "border-amber-200 dark:border-amber-800"
              : "border-slate-200 dark:border-slate-700"
          }`}
        >
          {children}
        </div>
      )}
    </div>
  );
};

const YesNoToggle = ({
  value,
  onChange,
  hasError = false,
}: {
  value: YesNo;
  onChange: (value: YesNo) => void;
  hasError?: boolean;
}) => (
  <div className="flex shrink-0 gap-1">
    {(["yes", "no"] as const).map((option) => (
      <button
        key={option}
        type="button"
        onClick={() => onChange(option)}
        className={`rounded-md border px-3 py-1 text-xs font-medium capitalize transition ${
          value === option
            ? "border-[#2C92D5] bg-[#2C92D5] text-white"
            : hasError
              ? "border-red-400 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-500 dark:bg-red-950/30 dark:text-red-300"
              : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
        }`}
      >
        {option}
      </button>
    ))}
  </div>
);

const CurrencyField = ({
  label,
  value,
  onChange,
  error,
  required = false,
  inline = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  inline?: boolean;
}) => (
  <div
    className={
      inline
        ? "grid grid-cols-[minmax(0,1fr)_190px] items-center gap-5"
        : "w-full"
    }
  >
    <label
      className={`text-sm font-medium text-slate-600 dark:text-slate-300 ${
        inline ? "" : "mb-1 block"
      }`}
    >
      {label}
      {required && <span className="text-red-500"> *</span>}
    </label>

    <div className={`relative ${inline ? "" : "mt-1"}`}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
        $
      </span>

      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(formatCurrencyInput(e.target.value))}
        placeholder="0"
        className={currencyInputClass(Boolean(error))}
      />
    </div>

    {error && <p className="col-span-2 text-xs text-red-500">{error}</p>}
  </div>
);

export default function ResidentialBorrowerPanel({
  borrowerIndex,
  isPrimary,
  borrower,
  errors,
  errorPrefix,
  formatUSPhone,
  formatSSN,
  onFieldChange,
  onAssetChange,
  onLiabilityChange,
  onDeclarationChange,
  onAddProperty,
  onRemoveProperty,
  onPropertyChange,
  onRemove,
  onAmountChange,
}: ResidentialBorrowerPanelProps) {
  const [expanded, setExpanded] = useState(true);

  const assets = borrower.assets ?? createEmptyAssets();
  const liabilities = borrower.liabilities ?? createEmptyLiabilities();
  const declarations = borrower.declarations ?? createEmptyDeclarations();
  const realEstateOwned = borrower.realEstateOwned ?? [];

  const totalAssets = sumBorrowerAssets(assets);
  const totalLiabilities = sumBorrowerLiabilities(liabilities);
  const netWorth = totalAssets - totalLiabilities;
  const scheduleTotal = sumScheduleMarketValue(realEstateOwned);
  const unansweredDeclarations = countUnansweredDeclarations(declarations);
  const hasDeclarationErrors = DECLARATION_QUESTIONS.some(({ key }) =>
    Boolean(errors[`${errorPrefix}.declarations.${key}`]),
  );
  const showDeclarationHighlight =
    unansweredDeclarations > 0 || hasDeclarationErrors;

  const err = (field: string) => errors[`${errorPrefix}.${field}`];

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-900/30">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="text-sm font-semibold text-slate-800 dark:text-slate-100"
          >
            Borrower {borrowerIndex + 1}
          </button>
          {isPrimary && (
            <span className="rounded-full bg-[#2C92D5]/10 px-2 py-0.5 text-xs font-semibold text-[#2C92D5]">
              Primary
            </span>
          )}
          <span className="text-xs text-slate-500">
            {borrower.entityOwnershipPercent || "0"}% ownership
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="text-lg text-red-500 hover:text-red-600"
            >
              <MdDeleteForever />
            </button>
          )}
          <button type="button" onClick={() => setExpanded((prev) => !prev)}>
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-slate-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-500" />
            )}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-200 px-4 pb-4 pt-3 dark:border-slate-700">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Basic Info
          </p>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                value={borrower.firstName}
                onChange={(e) => onFieldChange("firstName", e.target.value)}
                placeholder="Jane"
                className={inputClass(Boolean(err("firstName")))}
              />
              {err("firstName") && (
                <p className="mt-1 text-xs text-red-500">{err("firstName")}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                value={borrower.lastName}
                onChange={(e) => onFieldChange("lastName", e.target.value)}
                placeholder="Smith"
                className={inputClass(Boolean(err("lastName")))}
              />
              {err("lastName") && (
                <p className="mt-1 text-xs text-red-500">{err("lastName")}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Entity Ownership %
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={borrower.entityOwnershipPercent}
                onChange={(e) =>
                  onFieldChange(
                    "entityOwnershipPercent",
                    e.target.value.replace(/\D/g, "").slice(0, 3),
                  )
                }
                className={inputClass(false)}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Phone
              </label>
              <input
                type="tel"
                value={borrower.phone}
                onChange={(e) =>
                  onFieldChange("phone", formatUSPhone(e.target.value))
                }
                placeholder="416-555-1234"
                className={inputClass(Boolean(err("phone")))}
              />
              {err("phone") && (
                <p className="mt-1 text-xs text-red-500">{err("phone")}</p>
              )}
            </div>

            

            <div>
              <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={borrower.email}
                onChange={(e) => onFieldChange("email", e.target.value)}
                className={inputClass(Boolean(err("email")))}
              />
              {err("email") && (
                <p className="mt-1 text-xs text-red-500">{err("email")}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Social Security Number
              </label>
              <input
                value={borrower.ssn}
                onChange={(e) =>
                  onFieldChange("ssn", formatSSN(e.target.value))
                }
                placeholder="123-45-6789"
                className={inputClass(Boolean(err("ssn")))}
              />
              {err("ssn") && (
                <p className="mt-1 text-xs text-red-500">{err("ssn")}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Legal Status
              </label>
              <select
                value={borrower.legalStatus}
                onChange={(e) => onFieldChange("legalStatus", e.target.value)}
                className={inputClass(false)}
              >
                <option value="">Select</option>
                {LEGAL_STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Credit Score / FICO
              </label>
              <input
                value={borrower.creditScore}
                onChange={(e) => onFieldChange("creditScore", e.target.value)}
                placeholder="680–850"
                className={inputClass(Boolean(err("creditScore")))}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                # Similar Projects Completed
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={borrower.similarProjectsCompleted}
                onChange={(e) =>
                  onFieldChange(
                    "similarProjectsCompleted",
                    e.target.value.replace(/\D/g, ""),
                  )
                }
                className={inputClass(false)}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Years of Experience
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={borrower.yearsOfExperience}
                onChange={(e) =>
                  onFieldChange(
                    "yearsOfExperience",
                    e.target.value.replace(/\D/g, ""),
                  )
                }
                className={inputClass(false)}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Total Cash Reserves ($)
              </label>

              <div className="relative mt-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                  $
                </span>

                <input
                  type="text"
                  inputMode="numeric"
                  value={borrower.totalCashReserves}
                  onChange={(e) =>
                    onAmountChange(
                      "totalCashReserves",
                      formatCurrencyInput(e.target.value),
                    )
                  }
                  placeholder="0"
                  className={currencyInputClass(false)}
                />
              </div>
            </div>
          </div>

          <CollapsibleSection title="Assets & Liabilities">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#2C92D5]">
                  Assets
                </p>
                <div className="space-y-2">
                  {ASSET_FIELD_DEFS.map(({ key, label }) => (
                    <CurrencyField
                      key={key}
                      label={label}
                      value={assets[key]}
                      onChange={(value) => onAssetChange(key, value)}
                    />
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-red-500">
                  Liabilities
                </p>
                <div className="space-y-2">
                  {LIABILITY_FIELD_DEFS.map(({ key, label }) => (
                    <CurrencyField
                      key={key}
                      label={label}
                      value={liabilities[key]}
                      onChange={(value) => onLiabilityChange(key, value)}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 border-t border-slate-200 pt-4 text-sm dark:border-slate-700 md:grid-cols-3">
              <div className="flex justify-between md:block">
                <span className="font-medium text-[#2C92D5]">Total Assets</span>
                <span className="font-semibold text-[#2C92D5]">
                  ${totalAssets.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between md:block">
                <span className="font-medium text-red-500">
                  Total Liabilities
                </span>
                <span className="font-semibold text-red-500">
                  ${totalLiabilities.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between rounded-md bg-green-50 px-3 py-2 md:block dark:bg-green-900/20">
                <span className="font-medium text-green-700 dark:text-green-400">
                  Net Worth
                </span>
                <span className="font-semibold text-green-700 dark:text-green-400">
                  ${netWorth.toLocaleString()}
                </span>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Schedule of Real Estate Owned">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Schedule of Real Estate Owned
              </p>
              <button
                type="button"
                onClick={onAddProperty}
                className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Property
              </button>
            </div>

            {realEstateOwned.length === 0 ? (
              <p className="text-sm text-slate-500">No properties added yet.</p>
            ) : (
              <div className="space-y-4">
                {realEstateOwned.map((property, propertyIndex) => (
                  <div
                    key={property.id}
                    className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Property #{propertyIndex + 1}
                      </p>
                      <button
                        type="button"
                        onClick={() => onRemoveProperty(property.id)}
                        className="text-lg text-red-500 hover:text-red-600"
                      >
                        <MdDeleteForever />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                          Property Address
                        </label>
                        <input
                          value={property.propertyAddress}
                          onChange={(e) =>
                            onPropertyChange(
                              property.id,
                              "propertyAddress",
                              e.target.value,
                            )
                          }
                          className={inputClass(false)}
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                          Entity / Name on Title
                        </label>
                        <input
                          value={property.entityNameOnTitle}
                          onChange={(e) =>
                            onPropertyChange(
                              property.id,
                              "entityNameOnTitle",
                              e.target.value,
                            )
                          }
                          className={inputClass(false)}
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                          % of Ownership
                        </label>
                        <input
                          value={property.ownershipPercent}
                          onChange={(e) =>
                            onPropertyChange(
                              property.id,
                              "ownershipPercent",
                              e.target.value,
                            )
                          }
                          className={inputClass(false)}
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                          Property Type
                        </label>
                        <input
                          value={property.propertyType}
                          onChange={(e) =>
                            onPropertyChange(
                              property.id,
                              "propertyType",
                              e.target.value,
                            )
                          }
                          className={inputClass(false)}
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                          Acquisition Date
                        </label>
                        <LoanDateField
                          value={property.acquisitionDate}
                          onChange={(val) =>
                            onPropertyChange(
                              property.id,
                              "acquisitionDate",
                              val,
                            )
                          }
                        />
                      </div>

                      <CurrencyField
                        inline={false}
                        label="Rehab/Upgrade Cost ($) "
                        value={property.rehabUpgradeCost}
                        onChange={(value) =>
                          onPropertyChange(
                            property.id,
                            "rehabUpgradeCost",
                            value,
                          )
                        }
                      />

                      <CurrencyField
                        inline={false}
                        label="Current Market Value ($)"
                        value={property.currentMarketValue}
                        onChange={(value) =>
                          onPropertyChange(
                            property.id,
                            "currentMarketValue",
                            value,
                          )
                        }
                      />

                      <div className="md:col-span-2">
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                          Name &amp; Address of Mortgage Holder
                        </label>
                        <input
                          value={property.mortgageHolderNameAddress}
                          onChange={(e) =>
                            onPropertyChange(
                              property.id,
                              "mortgageHolderNameAddress",
                              e.target.value,
                            )
                          }
                          className={inputClass(false)}
                        />
                      </div>

                      <CurrencyField
                        inline={false}
                        label="Loan/Mortgage Balance ($)"
                        value={property.loanMortgageBalance}
                        onChange={(value) =>
                          onPropertyChange(
                            property.id,
                            "loanMortgageBalance",
                            value,
                          )
                        }
                      />

                      <CurrencyField
                        inline={false}
                        label="Gross Rental Income ($)"
                        value={property.grossRentalIncome}
                        onChange={(value) =>
                          onPropertyChange(
                            property.id,
                            "grossRentalIncome",
                            value,
                          )
                        }
                      />

                      <CurrencyField
                        inline={false}
                        label="Loan/Tax/Insurance Payment/yr ($)"
                        value={property.loanTaxInsurancePaymentYr}
                        onChange={(value) =>
                          onPropertyChange(
                            property.id,
                            "loanTaxInsurancePaymentYr",
                            value,
                          )
                        }
                      />

                      <CurrencyField
                        inline={false}
                        label="NOI per year ($)"
                        value={property.noiPerYear}
                        onChange={(value) =>
                          onPropertyChange(property.id, "noiPerYear", value)
                        }
                      />

                      <CurrencyField
                        inline={false}
                        label="Total Equity ($)"
                        value={property.totalEquity}
                        onChange={(value) =>
                          onPropertyChange(property.id, "totalEquity", value)
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between rounded-md bg-slate-100 px-4 py-2 text-sm dark:bg-slate-800">
              <span className="font-medium text-slate-600 dark:text-slate-300">
                Total Market Value (Schedule)
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                ${scheduleTotal.toLocaleString()}
              </span>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="Declarations — Required"
            defaultOpen
            highlighted={showDeclarationHighlight}
          >
            <p className="mb-3 text-xs text-amber-800 dark:text-amber-200">
              All declarations must be answered (Yes or No) to proceed.
            </p>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  DECLARATION_QUESTIONS.forEach(({ key }) =>
                    onDeclarationChange(key, "no"),
                  )
                }
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Answer all No
              </button>
              <button
                type="button"
                onClick={() =>
                  DECLARATION_QUESTIONS.forEach(({ key }) =>
                    onDeclarationChange(key, "yes"),
                  )
                }
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Answer all Yes
              </button>
              {unansweredDeclarations > 0 && (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  · {unansweredDeclarations} unanswered
                </span>
              )}
            </div>

            {unansweredDeclarations > 0 && (
              <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {unansweredDeclarations} declaration
                  {unansweredDeclarations === 1 ? "" : "s"} still require a
                  response (Yes / No)
                </span>
              </div>
            )}

            <div className="space-y-3">
              {DECLARATION_QUESTIONS.map(({ key, label }) => {
                const fieldError = errors[`${errorPrefix}.declarations.${key}`];
                const unanswered = !isDeclarationAnswered(declarations[key]);
                const current = declarations[key];

                return (
                  <div
                    key={key}
                    className={`flex items-center justify-between gap-4 rounded-md border px-3 py-2 ${
                      fieldError || unanswered
                        ? "border-amber-300 bg-amber-50/80 dark:border-amber-700 dark:bg-amber-950/20"
                        : "border-transparent"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        onDeclarationChange(
                          key,
                          current === "yes" ? "no" : "yes",
                        )
                      }
                      className="flex-1 text-left text-sm text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
                      title="Click to toggle Yes / No"
                    >
                      <span className="text-red-500">*</span> {label}
                      {current && (
                        <span className="ml-2 text-xs uppercase tracking-wide text-slate-400">
                          ({current})
                        </span>
                      )}
                    </button>
                    <YesNoToggle
                      value={declarations[key]}
                      onChange={(value) => onDeclarationChange(key, value)}
                      hasError={Boolean(fieldError)}
                    />
                  </div>
                );
              })}
            </div>

            {hasDeclarationErrors && (
              <p className="mt-3 text-xs text-red-600">
                Please answer every declaration before continuing.
              </p>
            )}
          </CollapsibleSection>
        </div>
      )}
    </div>
  );
}
