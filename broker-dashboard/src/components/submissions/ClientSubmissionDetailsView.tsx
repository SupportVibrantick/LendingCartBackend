import { FileText, User } from "lucide-react";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import {
  formatSubmissionFieldValue,
  getBorrowerDisplayNameFromFields,
  getEntityTypeFromFields,
  getSubmissionFieldLabel,
  groupSubmissionFieldsForDisplay,
  parseSubmissionFieldValue,
  PRODUCT_LABELS,
  type SubmissionDetailField,
} from "../../lib/submissionFieldUtils";

type ClientSubmissionDetailsViewProps = {
  application: any;
  fields: SubmissionDetailField[];
  loanAmount: number;
  ltv: number;
  ltc: number;
  arv: number;
  dscr: number;
  netWorth: number;
  submittedDate?: Date | null;
  formatStatusLabel: (status?: string) => string;
  getStatusChipClass: (status?: string) => string;
  sectionsOnly?: boolean;
};

function InfoCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value || "—"}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-sky-100/80 bg-white/80 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-base font-bold text-transparent">
        {value}
      </p>
    </div>
  );
}

function FieldItem({ field }: { field: SubmissionDetailField }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {getSubmissionFieldLabel(field)}
      </label>
      <div className="cursor-default select-none break-words rounded-lg border border-dashed border-slate-300 bg-slate-100 px-3 py-2.5 text-sm text-slate-700">
        {formatSubmissionFieldValue(field)}
      </div>
    </div>
  );
}

const formatCompactAmount = (value: number) => {
  if (!value || !Number.isFinite(value)) return "$0";
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1).replace(/\.0$/, "")}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1).replace(/\.0$/, "")}K`;
  return `$${value.toLocaleString("en-US")}`;
};

const formatLoanProduct = (code?: string | null, name?: string | null) => {
  if (name?.trim()) return name;
  if (!code) return "—";
  return PRODUCT_LABELS[code] || code.replace(/_/g, " ");
};

export default function ClientSubmissionDetailsView({
  application,
  fields,
  loanAmount,
  ltv,
  ltc,
  arv,
  dscr,
  netWorth,
  submittedDate,
  formatStatusLabel,
  getStatusChipClass,
  sectionsOnly = false,
}: ClientSubmissionDetailsViewProps) {
  const { sections, signatureField } = groupSubmissionFieldsForDisplay(fields);
  const loanProductCode =
    application?.loanProductCode ||
    fields.find((field) => field.fieldKey === "loanProductCode")?.value;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {!sectionsOnly && (
          <>
            <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
              <FileText size={16} className="text-cyan-600" />
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">
                Application Overview
              </h3>
            </div>

            <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <InfoCard
                label="Application Number"
                value={application?.applicationNumber}
              />
              <InfoCard
                label="Status"
                value={
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusChipClass(application?.status)}`}
                  >
                    {formatStatusLabel(application?.status)}
                  </span>
                }
              />
              <InfoCard
                label="Loan Product"
                value={formatLoanProduct(
                  String(loanProductCode || ""),
                  application?.loanProduct?.name,
                )}
              />
              <InfoCard
                label="Borrower"
                value={getBorrowerDisplayNameFromFields(
                  fields,
                  application?.borrowerName,
                )}
              />
              <InfoCard
                label="Entity Type"
                value={getEntityTypeFromFields(fields)}
              />
              <InfoCard
                label="Credit Score"
                value={
                  fields.find((field) => field.fieldKey === "creditScore")
                    ? formatSubmissionFieldValue(
                        fields.find((field) => field.fieldKey === "creditScore")!,
                      )
                    : application?.creditScore ?? "—"
                }
              />
              {submittedDate && (
                <>
                  <InfoCard
                    label="Submitted Date"
                    value={submittedDate.toLocaleDateString()}
                  />
                  <InfoCard
                    label="Submitted Time"
                    value={submittedDate.toLocaleTimeString()}
                  />
                </>
              )}
            </div>

            <div className="rounded-[24px] border border-sky-100 bg-gradient-to-br from-white via-sky-50 to-cyan-50 p-5">
              <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Key Loan Metrics
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <Metric
                  label="Loan Amount"
                  value={formatCompactAmount(Number(loanAmount || 0))}
                />
                <Metric label="LTV %" value={ltv ? `${ltv.toFixed(2)}%` : "—"} />
                <Metric label="LTC %" value={ltc ? `${ltc.toFixed(2)}%` : "—"} />
                <Metric label="ARV %" value={arv ? `${arv.toFixed(2)}%` : "—"} />
                <Metric label="DSCR" value={dscr ? dscr.toFixed(2) : "—"} />
                <Metric
                  label="Net Worth"
                  value={formatCompactAmount(Number(netWorth || 0))}
                />
              </div>
            </div>
          </>
        )}

        <div className={sectionsOnly ? "" : "mt-6 space-y-6"}>
          {sections.map((section) => (
            <motion.section
              key={section.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="overflow-hidden rounded-2xl border border-slate-200"
            >
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-5 py-3">
                <User size={15} className="text-violet-600" />
                <h3 className="text-sm font-bold text-slate-800">
                  {section.title}
                </h3>
                <span className="ml-auto text-xs text-slate-400">
                  {section.fields.length} field
                  {section.fields.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="grid gap-5 p-5 md:grid-cols-2">
                {section.fields.map((field) => (
                  <FieldItem
                    key={`${section.id}-${field.fieldKey}-${field.fieldId || ""}`}
                    field={field}
                  />
                ))}
              </div>
            </motion.section>
          ))}
        </div>

        {signatureField && !sectionsOnly && (
          <div className="mt-8 space-y-4 text-center">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
              Digital Signature
            </h3>
            <div className="flex justify-center">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <img
                  src={String(parseSubmissionFieldValue(signatureField.value))}
                  alt="Digital Signature"
                  className="h-40 object-contain"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
