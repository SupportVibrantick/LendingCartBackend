import {
  Building2,
  ChevronDown,
  CreditCard,
  FileText,
  Hash,
  Mail,
  User,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useState, type ReactNode } from "react";
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
  /** When true, only field accordion sections are rendered. */
  sectionsOnly?: boolean;
};

function InfoCell({
  label,
  value,
  icon,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/80 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-slate-300 hover:shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        {icon ? (
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 text-blue-600">
            {icon}
          </span>
        ) : null}
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          {label}
        </span>
      </div>
      <div className="text-[15px] font-semibold leading-snug text-slate-900">
        {value ?? "—"}
      </div>
    </div>
  );
}

function KpiCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  const isEmpty = !value || value === "—";
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${
        accent
          ? "border-blue-700/15 bg-gradient-to-br from-[#1d4ed8] to-[#0ea5e9] text-white"
          : "border-slate-200/80 bg-white"
      }`}
    >
      {accent ? (
        <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/10" />
      ) : null}
      <p
        className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${
          accent ? "text-white/70" : "text-slate-400"
        }`}
      >
        {label}
      </p>
      <p
        className={`mt-2 text-xl font-bold tabular-nums tracking-tight sm:text-2xl ${
          isEmpty
            ? accent
              ? "text-white/50"
              : "text-slate-300"
            : accent
              ? "text-white"
              : "text-slate-900"
        }`}
      >
        {value || "—"}
      </p>
    </div>
  );
}

function FieldItem({ field }: { field: SubmissionDetailField }) {
  const display = formatSubmissionFieldValue(field);
  const isEmpty = !display || display === "—";
  return (
    <div className="rounded-lg bg-slate-50/80 px-3 py-2.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {getSubmissionFieldLabel(field)}
      </span>
      <p
        className={`mt-1 break-words text-sm leading-snug ${
          isEmpty ? "italic text-slate-400" : "font-medium text-slate-900"
        }`}
      >
        {isEmpty ? "Not provided" : display}
      </p>
    </div>
  );
}

function isFieldEmpty(field: SubmissionDetailField): boolean {
  const raw = parseSubmissionFieldValue(field.value);
  if (raw === undefined || raw === null) return true;
  if (typeof raw === "string") {
    const t = raw.trim();
    return t === "" || t === "-" || t === "—";
  }
  if (Array.isArray(raw)) return raw.length === 0;
  return false;
}

function AccordionSection({
  title,
  fields,
  defaultOpen = false,
  filledCount,
}: {
  title: string;
  fields: SubmissionDetailField[];
  defaultOpen?: boolean;
  filledCount: number;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50/80"
      >
        <span className="h-8 w-1 rounded-full bg-blue-600" />
        <span className="flex-1 text-sm font-semibold text-slate-800">
          {title}
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-500">
          {filledCount} / {fields.length}
        </span>
        <ChevronDown
          size={15}
          className={`text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden border-t border-slate-100"
          >
            <div className="grid grid-cols-1 gap-2.5 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">
              {fields.map((field) => (
                <FieldItem
                  key={`${field.fieldKey}-${field.fieldId || ""}`}
                  field={field}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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

function resolveBroker(application: any) {
  if (application?.broker?.name) return application.broker;
  const org = application?.brokerOrg;
  if (!org) return null;
  return {
    id: org.id,
    name:
      org.brokerWhiteLabelSettings?.brandName?.trim() ||
      org.name ||
      "Broker",
    email: org.email || null,
  };
}

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
  const borrowerName = getBorrowerDisplayNameFromFields(
    fields,
    application?.borrowerName,
  );
  const loanProductName = formatLoanProduct(
    String(loanProductCode || ""),
    application?.loanProduct?.name,
  );
  const broker = resolveBroker(application);
  const creditScore = fields.find((field) => field.fieldKey === "creditScore")
    ? formatSubmissionFieldValue(
        fields.find((field) => field.fieldKey === "creditScore")!,
      )
    : (application?.creditScore ?? "—");

  const kpis = [
    {
      label: "Loan amount",
      value: formatCompactAmount(Number(loanAmount || 0)),
      accent: true,
    },
    { label: "LTV", value: ltv ? `${ltv.toFixed(2)}%` : "—" },
    { label: "LTC", value: ltc ? `${ltc.toFixed(2)}%` : "—" },
    { label: "ARV", value: arv ? `${arv.toFixed(2)}%` : "—" },
    { label: "DSCR", value: dscr ? dscr.toFixed(2) : "—" },
    {
      label: "Net worth",
      value: formatCompactAmount(Number(netWorth || 0)),
    },
  ];

  const sectionBlocks = (
    <div className="space-y-3">
      {sections.map((section, index) => {
        const visibleFields = section.fields.filter((f) => !isFieldEmpty(f));
        return (
          <AccordionSection
            key={section.id}
            title={section.title}
            fields={visibleFields}
            defaultOpen={index === 0}
            filledCount={visibleFields.length}
          />
        );
      })}
    </div>
  );

  if (sectionsOnly) {
    return <div className="space-y-3">{sectionBlocks}</div>;
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_-18px_rgba(15,23,42,0.35)]">
        <div className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-r from-[#1e3a8a] via-[#1d4ed8] to-[#0ea5e9] px-5 py-5 text-white sm:px-6">
          <div className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-12 left-24 h-32 w-32 rounded-full bg-cyan-300/15" />

          <div className="relative min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/85 ring-1 ring-white/15">
                <FileText size={12} />
                Application overview
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusChipClass(application?.status)}`}
              >
                {formatStatusLabel(application?.status)}
              </span>
            </div>
            <h2 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
              {borrowerName || "Borrower"}
            </h2>
            <p className="mt-1 text-sm text-white/75">
              {application?.applicationNumber || "—"}
              <span className="mx-2 text-white/35">·</span>
              {loanProductName}
              {broker?.name ? (
                <>
                  <span className="mx-2 text-white/35">·</span>
                  Broker: {broker.name}
                </>
              ) : null}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
          <InfoCell
            label="Application number"
            icon={<Hash size={12} />}
            value={application?.applicationNumber}
          />
          <InfoCell
            label="Borrower"
            icon={<User size={12} />}
            value={borrowerName}
          />
          <InfoCell
            label="Loan product"
            icon={<CreditCard size={12} />}
            value={loanProductName}
          />
          <InfoCell
            label="Broker"
            icon={<Building2 size={12} />}
            value={broker?.name || "—"}
          />
          {broker?.email ? (
            <InfoCell
              label="Broker email"
              icon={<Mail size={12} />}
              value={broker.email}
            />
          ) : (
            <InfoCell
              label="Entity type"
              icon={<Building2 size={12} />}
              value={getEntityTypeFromFields(fields)}
            />
          )}
          <InfoCell label="Credit score" value={creditScore} />
          {submittedDate ? (
            <InfoCell
              label="Submitted"
              value={
                <span>
                  {submittedDate.toLocaleDateString()}
                  <span className="mx-1.5 text-slate-300">·</span>
                  <span className="font-medium text-slate-500">
                    {submittedDate.toLocaleTimeString()}
                  </span>
                </span>
              }
            />
          ) : null}
        </div>
      </section>

      <section>
        <div className="mb-3 px-0.5">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Key loan metrics
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {kpis.map((kpi) => (
            <KpiCell
              key={kpi.label}
              label={kpi.label}
              value={kpi.value}
              accent={kpi.accent}
            />
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_30px_-20px_rgba(15,23,42,0.28)] sm:p-5">
        {sectionBlocks}

        {signatureField && (
          <div className="mt-5 border-t border-slate-100 pt-6 text-center">
            <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Digital signature (on file)
            </p>
            <div className="inline-block rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
              <img
                src={String(parseSubmissionFieldValue(signatureField.value))}
                alt="Digital Signature"
                className="h-28 object-contain"
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
