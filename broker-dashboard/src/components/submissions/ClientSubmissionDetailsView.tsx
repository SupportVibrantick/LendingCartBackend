import {
  Building2,
  Calendar,
  ChevronDown,
  FileText,
  Gauge,
  Loader2,
  Mail,
  Search,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  formatSubmissionFieldValue,
  getBorrowerDisplayNameFromFields,
  getEntityTypeFromFields,
  getSubmissionFieldLabel,
  groupSubmissionFieldsForDisplay,
  mapSubmissionDetailFields,
  parseSubmissionFieldValue,
  PRODUCT_LABELS,
  type SubmissionDetailField,
} from "../../lib/submissionFieldUtils";
import { getClientPortalAuthHeaders } from "../../lib/clientPortalApi";

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
  formatStatusLabel?: (status?: string) => string;
  getStatusChipClass?: (status?: string) => string;
  /** When true, only field accordion sections are rendered. */
  sectionsOnly?: boolean;
  /** Hide embedded signature — parent already shows a dedicated signature panel. */
  hideSignature?: boolean;
  /** Soft backend field search (debounced). */
  applicationId?: string;
  apiBase?: string;
  getAuthHeaders?: () => Record<string, string>;
};

function SummaryRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#E2E8F0] py-3 last:border-b-0 last:pb-0 first:pt-0">
      <div className="flex min-w-0 items-center gap-2.5">
        {icon ? (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#F7F9FC] text-[#4C78F5]">
            {icon}
          </span>
        ) : null}
        <span className="text-[13px] text-[#64748B]">{label}</span>
      </div>
      <div className="max-w-[60%] text-right text-[13px] font-semibold leading-snug text-[#111827]">
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
      className={`relative flex min-h-[96px] flex-col justify-between overflow-hidden rounded-[10px] border p-4 ${
        accent
          ? "border-[#4C78F5] bg-[#4C78F5] text-white shadow-sm shadow-[#4C78F5]/25"
          : "border-[#E2E8F0] bg-white"
      }`}
    >
      <p
        className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${
          accent ? "text-white/75" : "text-[#94A3B8]"
        }`}
      >
        {label}
      </p>
      <p
        className={`mt-3 text-[22px] font-semibold tabular-nums tracking-tight ${
          isEmpty
            ? accent
              ? "text-white/50"
              : "text-[#CBD5E1]"
            : accent
              ? "text-white"
              : "text-[#111827]"
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
    <div className="rounded-[8px] border border-[#E2E8F0] bg-[#F7F9FC] px-3 py-2.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">
        {getSubmissionFieldLabel(field)}
      </span>
      <p
        className={`mt-1 break-words text-[13px] leading-snug ${
          isEmpty ? "italic text-[#94A3B8]" : "font-medium text-[#111827]"
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

const ALWAYS_SHOW_EMPTY_SECTION_IDS = new Set([
  "property-details",
  "loan-details",
  "entity-information",
  "primary-borrower",
]);

function AccordionSection({
  title,
  fields,
  defaultOpen = false,
  filledCount,
  totalCount,
}: {
  title: string;
  fields: SubmissionDetailField[];
  defaultOpen?: boolean;
  filledCount: number;
  totalCount: number;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white">
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[#F7F9FC]"
      >
        <span className="h-7 w-1 rounded-full bg-[#4C78F5]" />
        <span className="flex-1 text-[14px] font-semibold text-[#111827]">
          {title}
        </span>
        <span className="rounded-full bg-[#4C78F5]/10 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-[#4C78F5]">
          {filledCount}/{totalCount}
        </span>
        <ChevronDown
          size={15}
          className={`text-[#94A3B8] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
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
            className="overflow-hidden border-t border-[#E2E8F0]"
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
  sectionsOnly = false,
  hideSignature = false,
  applicationId,
  apiBase,
  getAuthHeaders,
}: ClientSubmissionDetailsViewProps) {
  const preferredEmail =
    application?.clientEmail ||
    application?.borrower?.email ||
    application?.email ||
    null;
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [remoteFields, setRemoteFields] = useState<SubmissionDetailField[] | null>(
    null,
  );
  const [searchLoading, setSearchLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchFocusedRef = useRef(false);
  const searchRequestIdRef = useRef(0);
  const getAuthHeadersRef = useRef(getAuthHeaders);
  getAuthHeadersRef.current = getAuthHeaders;

  const backendSearchEnabled = Boolean(applicationId && apiBase);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setSearchInput("");
    setDebouncedSearch("");
    setRemoteFields(null);
    setSearchLoading(false);
  }, [application?.id, applicationId]);

  useEffect(() => {
    if (!backendSearchEnabled) {
      setRemoteFields(null);
      setSearchLoading(false);
      return;
    }

    const query = debouncedSearch.trim();
    if (!query) {
      setRemoteFields(null);
      setSearchLoading(false);
      return;
    }

    const requestId = ++searchRequestIdRef.current;
    let cancelled = false;

    (async () => {
      setSearchLoading(true);
      try {
        const params = new URLSearchParams({ search: query });
        const headers =
          getAuthHeadersRef.current?.() || getClientPortalAuthHeaders();
        const res = await fetch(
          `${apiBase}/client-portal/applications/${applicationId}?${params.toString()}`,
          { headers },
        );
        const json = await res.json().catch(() => null);
        if (cancelled || requestId !== searchRequestIdRef.current) return;
        if (!res.ok || !json?.success) {
          setRemoteFields([]);
          return;
        }

        const latest =
          json.data?.latestSubmission || json.data?.submissions?.[0] || null;
        setRemoteFields(mapSubmissionDetailFields(latest?.fields || []));
      } catch {
        if (!cancelled && requestId === searchRequestIdRef.current) {
          setRemoteFields([]);
        }
      } finally {
        if (!cancelled && requestId === searchRequestIdRef.current) {
          setSearchLoading(false);
          if (searchFocusedRef.current) {
            requestAnimationFrame(() => {
              searchInputRef.current?.focus({ preventScroll: true });
            });
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [apiBase, applicationId, backendSearchEnabled, debouncedSearch]);

  const activeSearchQuery = debouncedSearch.trim();
  const detailFields = useMemo(() => {
    if (!backendSearchEnabled) return fields;
    if (!activeSearchQuery) return fields;
    // Keep current results while a newer request is in flight.
    if (remoteFields == null) return fields;
    return remoteFields;
  }, [activeSearchQuery, backendSearchEnabled, fields, remoteFields]);

  const { sections, signatureField } = groupSubmissionFieldsForDisplay(fields, {
    preferredEmail,
  });
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
  const dateOfBirthField = fields.find((field) => field.fieldKey === "dob");
  const dateOfBirth = dateOfBirthField
    ? formatSubmissionFieldValue(dateOfBirthField)
    : "";

  const kpis = [
    {
      label: "Loan amount",
      value: loanAmount ? formatCompactAmount(Number(loanAmount)) : "",
      accent: true,
    },
    { label: "LTV", value: ltv ? `${ltv.toFixed(2)}%` : "" },
    { label: "LTC", value: ltc ? `${ltc.toFixed(2)}%` : "" },
    { label: "ARV", value: arv ? `${arv.toFixed(2)}%` : "" },
    { label: "DSCR", value: dscr ? dscr.toFixed(2) : "" },
    {
      label: "Net worth",
      value: netWorth ? formatCompactAmount(Number(netWorth)) : "",
    },
  ].filter((kpi) => kpi.value && kpi.value !== "—" && kpi.value !== "$0");

  const entityType = getEntityTypeFromFields(fields);
  const detailFacts = [
    broker?.email
      ? {
          label: "Broker email",
          icon: <Mail size={12} />,
          value: broker.email,
        }
      : null,
    entityType && entityType !== "—"
      ? {
          label: "Entity type",
          icon: <Building2 size={12} />,
          value: entityType,
        }
      : null,
    dateOfBirth && dateOfBirth !== "—" && dateOfBirth !== "-"
      ? {
          label: "Date of birth",
          icon: <Calendar size={12} />,
          value: dateOfBirth,
        }
      : null,
    creditScore && creditScore !== "—"
      ? {
          label: "Credit score",
          icon: <Gauge size={12} />,
          value: creditScore,
        }
      : null,
    submittedDate
      ? {
          label: "Submitted",
          icon: <FileText size={12} />,
          value: (
            <span>
              {submittedDate.toLocaleDateString()}
              <span className="mx-1.5 text-gray-300">·</span>
              <span className="font-medium text-gray-500">
                {submittedDate.toLocaleTimeString()}
              </span>
            </span>
          ),
        }
      : null,
  ].filter(Boolean) as Array<{
    label: string;
    icon?: ReactNode;
    value: ReactNode;
  }>;

  const filteredSections = useMemo(() => {
    const { sections: detailSections } = groupSubmissionFieldsForDisplay(
      detailFields,
      { preferredEmail },
    );

    // Backend already filtered; only hide empty values (unless section always shows).
    // Without backend search, keep a local filter fallback for other callers.
    const q =
      backendSearchEnabled || !activeSearchQuery
        ? ""
        : activeSearchQuery.toLowerCase();

    return detailSections
      .map((section) => {
        const showEmpty = ALWAYS_SHOW_EMPTY_SECTION_IDS.has(section.id);
        const baseFields = showEmpty
          ? section.fields
          : section.fields.filter((field) => !isFieldEmpty(field));
        const nextFields = q
          ? baseFields.filter((field) => {
              const label = String(
                field.label || field.fieldKey || "",
              ).toLowerCase();
              const value = formatSubmissionFieldValue(field)
                .toString()
                .toLowerCase();
              const key = (field.fieldKey || "").toLowerCase();
              return label.includes(q) || value.includes(q) || key.includes(q);
            })
          : baseFields;
        return { ...section, fields: nextFields };
      })
      .filter((section) => section.fields.length > 0);
  }, [
    activeSearchQuery,
    backendSearchEnabled,
    detailFields,
    preferredEmail,
  ]);

  const sectionBlocks = (
    <div
      className={`space-y-3 transition-opacity ${
        searchLoading ? "opacity-60" : ""
      }`}
    >
      {filteredSections.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-[#E2E8F0] px-5 py-10 text-center text-[14px] text-[#94A3B8]">
          {searchLoading
            ? "Searching fields…"
            : activeSearchQuery
              ? `No fields match “${activeSearchQuery}”`
              : "No application answers to show yet."}
        </div>
      ) : (
        filteredSections.map((section) => {
          const original = sections.find((item) => item.id === section.id);
          const totalCount = original?.fields.length ?? section.fields.length;
          const filledCount =
            original?.fields.filter((field) => !isFieldEmpty(field)).length ??
            section.fields.filter((field) => !isFieldEmpty(field)).length;
          return (
            <AccordionSection
              key={section.id}
              title={section.title}
              fields={section.fields}
              defaultOpen
              filledCount={filledCount}
              totalCount={totalCount}
            />
          );
        })
      )}
    </div>
  );

  if (sectionsOnly) {
    return <div className="space-y-3">{sectionBlocks}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-12">
        {/* Deal Summary */}
        <section className="overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white xl:col-span-7">
          <div className="border-b border-[#E2E8F0] px-5 py-4 sm:px-6">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#4C78F5]/10 text-[#4C78F5]">
                <FileText size={16} />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4C78F5]">
                  Deal Summary
                </p>
                <h2 className="mt-1 truncate text-[20px] font-semibold tracking-tight text-[#111827]">
                  {borrowerName || "Borrower"}
                </h2>
                <p className="mt-0.5 truncate text-[13px] font-medium text-[#64748B]">
                  {loanProductName}
                  {broker?.name ? ` · ${broker.name}` : ""}
                </p>
              </div>
            </div>
          </div>

          <div className="px-5 py-2 sm:px-6">
            {detailFacts.length > 0 ? (
              detailFacts.map((fact) => (
                <SummaryRow
                  key={fact.label}
                  label={fact.label}
                  icon={fact.icon}
                  value={fact.value}
                />
              ))
            ) : (
              <p className="py-6 text-center text-[13px] text-[#94A3B8]">
                No summary details available yet.
              </p>
            )}
          </div>
        </section>

        {/* Key metrics */}
        <section className="overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white xl:col-span-5">
          <div className="border-b border-[#E2E8F0] px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="h-4 w-1 rounded-full bg-[#4C78F5]" />
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748B]">
                Key loan metrics
              </h3>
            </div>
          </div>
          <div className="p-4 sm:p-5">
            {kpis.length > 0 ? (
              <div
                className={`grid gap-3 ${
                  kpis.length === 1
                    ? "grid-cols-1"
                    : kpis.length === 2
                      ? "grid-cols-2"
                      : "grid-cols-2 sm:grid-cols-3 xl:grid-cols-2"
                }`}
              >
                {kpis.map((kpi) => (
                  <KpiCell
                    key={kpi.label}
                    label={kpi.label}
                    value={kpi.value}
                    accent={kpi.accent}
                  />
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-[13px] text-[#94A3B8]">
                Metrics will appear once loan details are available.
              </p>
            )}
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="h-4 w-1 rounded-full bg-[#4C78F5]" />
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748B]">
              Application details
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-[220px] sm:w-[260px]">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onFocus={() => {
                  searchFocusedRef.current = true;
                }}
                onBlur={() => {
                  searchFocusedRef.current = false;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.preventDefault();
                }}
                placeholder="Search all fields…"
                autoComplete="off"
                className="h-9 w-full rounded-[8px] border border-[#E2E8F0] bg-white py-2 pl-9 pr-8 text-[13px] text-[#111827] outline-none placeholder:text-[#94A3B8] focus:border-[#4C78F5] focus:ring-4 focus:ring-[#4C78F5]/15"
              />
              {searchInput ? (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setSearchInput("");
                    setDebouncedSearch("");
                    setRemoteFields(null);
                    searchInputRef.current?.focus();
                  }}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#94A3B8] hover:bg-[#F7F9FC] hover:text-[#64748B]"
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>
            {searchLoading ? (
              <Loader2
                size={15}
                className="shrink-0 animate-spin text-[#4C78F5]"
                aria-label="Searching"
              />
            ) : null}
          </div>
        </div>
        {sectionBlocks}

        {signatureField && !hideSignature ? (
          <div className="mt-5 border-t border-[#E2E8F0] pt-6 text-center">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
              Digital signature (on file)
            </p>
            <div className="inline-block rounded-[10px] border border-[#E2E8F0] bg-[#F7F9FC] p-5">
              <img
                src={String(parseSubmissionFieldValue(signatureField.value))}
                alt="Digital Signature"
                className="h-28 object-contain"
              />
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
