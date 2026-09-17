import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Building2,
  ChevronDown,
  ExternalLink,
  FileText,
  Loader2,
  User,
} from "lucide-react";
import { ADMIN_API_BASE } from "../../lib/adminApi";
import { getLoanPipelineApplicationId } from "../../lib/loanPipelineNavigation";
import {
  formatEntityTypeLabel,
  parseFieldValue,
  resolveBorrowerName,
  resolveEntityType,
  resolveLoanAmount,
  resolvePurpose,
  resolveTermLabel,
} from "../../lib/loanPipelineUtils";

type DetailField = {
  id: string;
  fieldKey?: string | null;
  label?: string | null;
  fieldType?: string | null;
  sortOrder?: number | null;
  value?: unknown;
  sectionId?: string | null;
  sectionName?: string | null;
  sectionSortOrder?: number | null;
};

type LenderItem = {
  lenderOrgId: string;
  lenderName?: string;
  lenderProduct?: string;
  lenderStatus?: string;
  sentAt?: string | null;
  decision?: string | null;
};

const LOAN_TYPE_LABELS: Record<string, string> = {
  FIX_AND_FLIP_LOAN_1_TO_4_UNITS: "Fix & Flip",
  DSCR_LOAN: "DSCR",
  BRIDGE_LOAN: "Bridge",
  EQUIPMENT_FINANCE: "Equipment",
};

const SIGNATURE_KEYS = new Set([
  "borrowerSignature",
  "signature",
  "applicantSignature",
]);

/** Preferred key first — keep only one field per group. */
const FIELD_ALIAS_GROUPS: string[][] = [
  ["borrowerFirstName", "applicantFirstName", "first_name", "firstName"],
  ["borrowerLastName", "applicantLastName", "last_name", "lastName"],
  ["borrowerEmail", "applicantEmail", "email"],
  ["borrowerPhone", "applicantPhone", "mobile", "cellPhone", "phone"],
  ["ssn", "socialSecurityNumber", "taxId"],
  // Prefer human-readable product name; never surface raw product code in sections.
  ["loanProductName", "productName", "loanProduct", "loanType", "product"],
  ["amountRequested", "loanAmount", "requestedAmount", "loan_amount"],
  ["purpose", "loanPurpose", "useOfFunds"],
  ["entityType", "borrowerEntityType", "businessEntityType"],
  ["entityLegalName", "businessLegalName", "businessName", "companyName", "legalName"],
  ["minTermMonths", "requested_term_years", "termMonths", "loanTerm"],
  ["maxTermMonths"],
];

const HIDDEN_FIELD_KEYS = new Set([
  ...SIGNATURE_KEYS,
  "loanProductCode",
  "loan_product_code",
  "productCode",
]);

const LOAN_PRODUCT_NAME_KEYS = new Set([
  "loanProductName",
  "productName",
  "loanProduct",
  "loanType",
  "product",
]);

const INTERNAL_FINANCIAL_METADATA_KEYS = new Set([
  "financialReferenceYear",
  "financialYearColumnCount",
]);

const ANNUAL_FINANCIAL_ROWS = [
  { key: "grossRevenue", label: "Gross Revenue" },
  { key: "grossRentalIncome", label: "Gross Rental Income" },
  { key: "vacancyCreditLoss", label: "Vacancy & Credit Loss" },
  { key: "operatingExpenses", label: "Operating Expenses" },
  { key: "mortgageDebtService", label: "Mortgage / Debt Service" },
  {
    key: "effectiveGrossIncomeOverride",
    label: "Effective Gross Income",
    computed: true,
  },
  {
    key: "noiOverride",
    label: "Net Operating Income (NOI)",
    computed: true,
  },
  {
    key: "cashFlowAfterDebtOverride",
    label: "Cash Flow After Debt Service",
    computed: true,
  },
];

function isAnnualFinancialField(fieldKey?: string | null) {
  if (!fieldKey) return false;
  return (
    /^financialYear_col\d+$/i.test(fieldKey) ||
    /^financial_.+_col\d+(?:_computed)?$/i.test(fieldKey)
  );
}

function formatLoanType(code?: string | null) {
  if (!code) return "—";
  if (LOAN_TYPE_LABELS[code]) return LOAN_TYPE_LABELS[code];
  return code.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatCompactAmount(value: number) {
  if (!value || Number.isNaN(value)) return "—";
  if (value >= 1_000_000)
    return `$${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  if (value >= 1_000)
    return `$${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}K`;
  return `$${value.toLocaleString()}`;
}

function getNumericFieldValue(fields: DetailField[], ...keys: string[]) {
  const field = fields.find(
    (item) => item.fieldKey && keys.includes(item.fieldKey),
  );
  if (!field) return 0;

  const parsed = parseFieldValue(field.value);
  const numeric = Number(String(parsed ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function calculateMonthlyPayment(
  loanAmount: number,
  interestRate: number,
  termMonths: number,
) {
  if (!loanAmount || !termMonths || termMonths <= 0 || interestRate < 0) {
    return 0;
  }

  const monthlyRate = interestRate / 100 / 12;
  if (monthlyRate === 0) return loanAmount / termMonths;

  return (
    (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
    (Math.pow(1 + monthlyRate, termMonths) - 1)
  );
}

function formatShortDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatStatusLabel(status?: string | null) {
  if (!status) return "Unknown";
  if (
    status === "APPROVED" ||
    status === "LENDER_APPROVED" ||
    status === "AUTO_APPROVED"
  ) {
    return "Approved";
  }
  if (status === "FUNDED") return "Funded";
  if (
    status === "DECLINED" ||
    status === "REJECTED" ||
    status === "LENDER_DECLINED" ||
    status === "AUTO_DECLINED"
  ) {
    return "Rejected";
  }
  if (status === "CLIENT_PENDING") return "Client Pending";
  if (status === "IN_REVIEW") return "In Review";
  if (status === "LENDER_SELECTED") return "Lender Selected";
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getApplicationStatusColor(status?: string | null) {
  if (!status) return "bg-slate-100 text-slate-700 border-slate-200";
  const cleaned = status.replace(/^LENDER_/, "").replace(/^AUTO_/, "");
  switch (cleaned) {
    case "APPROVED":
    case "FUNDED":
      return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20";
    case "DECLINED":
    case "REJECTED":
      return "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20";
    case "IN_REVIEW":
      return "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20";
    case "SUBMITTED":
    case "SELECTED":
    case "SENT":
      return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20";
    case "CLIENT_PENDING":
      return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20";
    case "DRAFT":
      return "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
  }
}

function formatFieldKey(key: string | null | undefined) {
  if (!key) return "";
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/** Make enum/code-like values readable (remove underscores, title case). */
function formatDisplayValue(raw: unknown, fieldKey?: string | null): string {
  const parsed = parseFieldValue(raw);
  if (!parsed || parsed === "-" || parsed === "—") return "—";

  if (fieldKey === "dscrCalculationMethod") {
    if (parsed.toLowerCase() === "noi") return "Net Operating Income (NOI)";
    if (parsed.toLowerCase() === "proforma") return "Pro Forma NOI";
  }

  if (fieldKey && LOAN_PRODUCT_NAME_KEYS.has(fieldKey)) {
    return formatLoanType(parsed);
  }

  // Keep URLs, emails, phones, and signatures as-is.
  if (
    /^(https?:\/\/|data:)/i.test(parsed) ||
    parsed.includes("@") ||
    /^[\d\s()+.-]+$/.test(parsed)
  ) {
    return parsed;
  }

  // SCREAMING_SNAKE or snake_case codes → Title Case words
  if (/^[A-Za-z0-9]+(_[A-Za-z0-9]+)+$/.test(parsed)) {
    return parsed
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // Single ALL_CAPS token (e.g. FIXED, YES)
  if (/^[A-Z]{2,}$/.test(parsed)) {
    return parsed.charAt(0) + parsed.slice(1).toLowerCase();
  }

  // Soft cleanup if underscores slipped into mixed text
  if (parsed.includes("_")) {
    return parsed.replace(/_/g, " ");
  }

  return parsed;
}

function fieldDisplayLabel(field: DetailField) {
  const key = field.fieldKey || "";
  if (key === "dscrCalculationMethod") return "DSCR Calculation Basis";
  if (LOAN_PRODUCT_NAME_KEYS.has(key)) return "Loan Product Name";
  const label = field.label || formatFieldKey(field.fieldKey);
  if (/product\s*code/i.test(label)) return "Loan Product Name";
  return label;
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s,_-]+/g, "");
}

function normalizeLabel(label: string) {
  return label
    .toLowerCase()
    .replace(/\bborrower\b/g, "")
    .replace(/\bapplicant\b/g, "")
    .replace(/\bclient\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function getAuthHeaders(): HeadersInit {
  const token = sessionStorage.getItem("admin_token");
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

function resolveFileUrl(fileUrl?: string | null) {
  if (!fileUrl) return null;
  if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
    return fileUrl;
  }
  const base = ADMIN_API_BASE.replace(/\/+$/, "");
  return `${base}${fileUrl.startsWith("/") ? fileUrl : `/${fileUrl}`}`;
}

function inferSectionName(fieldKey?: string | null) {
  const key = (fieldKey || "").toLowerCase();
  if (!key) return "Additional Details";
  if (
    key.includes("borrower") ||
    key.includes("first") ||
    key.includes("last") ||
    key.includes("email") ||
    key.includes("phone") ||
    key.includes("ssn") ||
    key.includes("dob") ||
    key.includes("contact")
  ) {
    return "Borrower Information";
  }
  if (
    key.includes("entity") ||
    key.includes("business") ||
    key.includes("company") ||
    key.includes("ein") ||
    key.includes("dba")
  ) {
    return "Entity / Business";
  }
  if (
    key.includes("amount") ||
    key.includes("loan") ||
    key.includes("term") ||
    key.includes("purpose") ||
    key.includes("rate") ||
    key.includes("ltv") ||
    key.includes("product")
  ) {
    return "Loan Request";
  }
  if (
    key.includes("property") ||
    key.includes("address") ||
    key.includes("collateral") ||
    key.includes("city") ||
    key.includes("state") ||
    key.includes("zip")
  ) {
    return "Property / Collateral";
  }
  if (
    key.includes("income") ||
    key.includes("revenue") ||
    key.includes("expense") ||
    key.includes("dscr") ||
    key.includes("financial") ||
    key.includes("debt")
  ) {
    return "Financials";
  }
  return "Additional Details";
}

function dedupeFields(
  fields: DetailField[],
  overviewValues: Set<string>,
): DetailField[] {
  const byKey = new Map<string, DetailField>();
  for (const field of fields) {
    if (!field.fieldKey) continue;
    if (HIDDEN_FIELD_KEYS.has(field.fieldKey)) continue;
    if (
      INTERNAL_FINANCIAL_METADATA_KEYS.has(field.fieldKey) ||
      isAnnualFinancialField(field.fieldKey)
    ) {
      continue;
    }
    byKey.set(field.fieldKey, field);
  }

  const chosenKeys = new Set<string>();
  const preferred: DetailField[] = [];

  for (const group of FIELD_ALIAS_GROUPS) {
    let picked: DetailField | null = null;
    for (const key of group) {
      const field = byKey.get(key);
      if (!field) continue;
      const display = normalizeText(
        formatDisplayValue(field.value, field.fieldKey),
      );
      if (!display || display === "-" || display === "—") continue;
      picked = field;
      break;
    }
    if (picked?.fieldKey) {
      preferred.push(picked);
      for (const key of group) chosenKeys.add(key);
    } else {
      for (const key of group) chosenKeys.add(key);
    }
  }

  // Always hide product code keys even if not in alias groups.
  for (const key of HIDDEN_FIELD_KEYS) chosenKeys.add(key);

  for (const field of fields) {
    if (!field.fieldKey || HIDDEN_FIELD_KEYS.has(field.fieldKey)) continue;
    if (
      INTERNAL_FINANCIAL_METADATA_KEYS.has(field.fieldKey) ||
      isAnnualFinancialField(field.fieldKey)
    ) {
      continue;
    }
    if (chosenKeys.has(field.fieldKey)) continue;
    // Hide labels that are clearly "product code"
    const label = (field.label || "").toLowerCase();
    if (label.includes("product code") || label.includes("loan product code")) {
      continue;
    }
    preferred.push(field);
  }

  const result: DetailField[] = [];
  const seenValueLabel = new Set<string>();

  for (const field of preferred) {
    const display = formatDisplayValue(field.value, field.fieldKey);
    const normalizedValue = normalizeText(display);
    if (!normalizedValue || normalizedValue === "-" || normalizedValue === "—") {
      continue;
    }

    if (overviewValues.has(normalizedValue)) continue;

    const label = fieldDisplayLabel(field);
    const labelKey = normalizeLabel(label);
    const dedupeKey = `${labelKey}::${normalizedValue}`;
    if (seenValueLabel.has(dedupeKey)) continue;

    const softKey = `${labelKey.replace(/name$/, "name")}::${normalizedValue}`;
    if (seenValueLabel.has(softKey)) continue;

    seenValueLabel.add(dedupeKey);
    seenValueLabel.add(softKey);
    result.push(field);
  }

  return result;
}

function groupFieldsBySection(fields: DetailField[]) {
  const groups = new Map<
    string,
    {
      id: string;
      name: string;
      sortOrder: number;
      fields: DetailField[];
    }
  >();

  for (const field of fields) {
    const name =
      field.sectionName?.trim() || inferSectionName(field.fieldKey);
    const id = field.sectionId || name;
    const sortOrder =
      field.sectionSortOrder ??
      (name === "Borrower Information"
        ? 10
        : name === "Entity / Business"
          ? 20
          : name === "Loan Request"
            ? 30
            : name === "Property / Collateral"
              ? 40
              : name === "Financials"
                ? 50
                : 100);

    if (!groups.has(id)) {
      groups.set(id, { id, name, sortOrder, fields: [] });
    }
    groups.get(id)!.fields.push(field);
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      fields: [...group.fields].sort(
        (a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999),
      ),
    }))
    .filter((group) => group.fields.length > 0)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

function buildAnnualFinancialTable(fields: DetailField[]) {
  const fieldMap = new Map(
    fields
      .filter((field) => field.fieldKey)
      .map((field) => [field.fieldKey!, parseFieldValue(field.value)]),
  );

  const columnKeys = Array.from(
    new Set(
      fields.flatMap((field) => {
        const match = field.fieldKey?.match(/(?:financialYear_|_)(col\d+)/i);
        return match ? [match[1].toLowerCase()] : [];
      }),
    ),
  ).sort(
    (left, right) =>
      Number(left.replace("col", "")) - Number(right.replace("col", "")),
  );

  const columns = columnKeys.map((column, index) => ({
    key: column,
    label:
      String(fieldMap.get(`financialYear_${column}`) || "").trim() ||
      `Year ${index + 1}`,
  }));

  const rows = ANNUAL_FINANCIAL_ROWS.map((row) => {
    const values = columns.map(({ key: column }) => {
      const entered = fieldMap.get(`financial_${row.key}_${column}`);
      const computed = fieldMap.get(
        `financial_${row.key}_${column}_computed`,
      );
      const value =
        entered !== undefined && entered !== null && entered !== ""
          ? entered
          : computed;

      if (value === undefined || value === null || value === "") return "—";
      const numeric = Number(String(value).replace(/[^0-9.-]/g, ""));
      return Number.isFinite(numeric)
        ? new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0,
          }).format(numeric)
        : String(value);
    });

    return { ...row, values };
  }).filter((row) => row.values.some((value) => value !== "—"));

  return { columns, rows };
}

function InfoCard({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
      <p className="mb-1 text-xs text-slate-500">{label}</p>
      <p className="break-words text-sm font-semibold text-slate-900 dark:text-slate-100">
        {value || "—"}
      </p>
    </div>
  );
}

function SectionCard({
  id,
  title,
  description,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  open: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <button
        type="button"
        onClick={() => onToggle(id)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/50 sm:px-6"
      >
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-xs text-slate-500">{description}</p>
          ) : null}
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open ? (
        <div className="border-t border-slate-100 p-5 dark:border-slate-800 sm:p-6">
          {children}
        </div>
      ) : null}
    </section>
  );
}

export default function ApplicationDetail() {
  const location = useLocation();
  const navigate = useNavigate();
  const applicationId = useMemo(
    () =>
      getLoanPipelineApplicationId(
        location.state as { applicationId?: string } | null,
      ),
    [location.state],
  );
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    overview: true,
  });

  useEffect(() => {
    if (!applicationId) {
      toast.error("Application not found");
      navigate("/loan-pipeline", { replace: true });
      return;
    }

    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        const res = await fetch(
          `${ADMIN_API_BASE}/admin/loan-pipeline/${applicationId}`,
          {
            headers: getAuthHeaders(),
            signal: controller.signal,
          },
        );
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.message || "Failed to load application");
        }
        setDetail(json.data);
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        toast.error(err.message || "Failed to load application");
        navigate("/loan-pipeline", { replace: true });
      } finally {
        setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [applicationId, navigate]);

  const amount = detail ? resolveLoanAmount(detail) : null;
  const borrowerName = detail ? resolveBorrowerName(detail) : "";
  const productLabel = detail ? formatLoanType(detail.loanProductCode) : "";
  const purpose = detail ? resolvePurpose(detail) || "" : "";
  const entityLabel = detail
    ? formatEntityTypeLabel(detail.entityType || resolveEntityType(detail))
    : "";
  const termLabel = detail ? resolveTermLabel(detail) || "" : "";
  const fields: DetailField[] = detail?.submissions?.[0]?.fields || [];
  const annualFinancialTable = useMemo(
    () => buildAnnualFinancialTable(fields),
    [fields],
  );

  const ltv = getNumericFieldValue(fields, "ltvPercentage");
  const ltc = getNumericFieldValue(fields, "ltcPercentage");
  const arv = getNumericFieldValue(fields, "arvPercentage");
  const dscr =
    getNumericFieldValue(fields, "dscr") ||
    Number(detail?.financials?.dscr || 0);
  const netWorth = getNumericFieldValue(fields, "netWorth");
  const interestRate = getNumericFieldValue(fields, "interestRate");
  const amortizationYears = getNumericFieldValue(fields, "amortization");
  const loanTermMonths = getNumericFieldValue(
    fields,
    "loanTerm",
    "termMonths",
  );
  const paymentTermMonths =
    amortizationYears > 0 ? amortizationYears * 12 : loanTermMonths;
  const monthlyPayment = calculateMonthlyPayment(
    Number(amount || 0),
    interestRate,
    paymentTermMonths,
  );

  const metrics = [
    {
      label: "Monthly Payment",
      value: monthlyPayment ? formatCompactAmount(monthlyPayment) : "—",
    },
    { label: "LTV", value: ltv ? `${ltv.toFixed(2)}%` : "—" },
    { label: "LTC", value: ltc ? `${ltc.toFixed(2)}%` : "—" },
    { label: "ARV %", value: arv ? `${arv.toFixed(2)}%` : "—" },
    { label: "DSCR Ratio", value: dscr ? dscr.toFixed(2) : "—" },
    {
      label: "Net Worth",
      value: netWorth ? formatCompactAmount(netWorth) : "—",
    },
  ];

  const overviewValues = useMemo(() => {
    const values = new Set<string>();
    for (const value of [
      borrowerName,
      productLabel,
      purpose,
      entityLabel,
      termLabel,
      detail?.applicationNumber,
      detail?.brokerOrg?.name,
      detail?.client?.legalName,
      detail?.entityLabel,
      amount != null ? formatCompactAmount(amount) : null,
      amount != null ? String(amount) : null,
    ]) {
      const normalized = normalizeText(value);
      if (normalized) values.add(normalized);
    }

    // Also block first/last name pieces when full borrower name is shown.
    for (const part of borrowerName.split(/\s+/)) {
      const normalized = normalizeText(part);
      if (normalized.length > 1) values.add(normalized);
    }

    return values;
  }, [
    amount,
    borrowerName,
    detail?.applicationNumber,
    detail?.brokerOrg?.name,
    detail?.client?.legalName,
    detail?.entityLabel,
    entityLabel,
    productLabel,
    purpose,
    termLabel,
  ]);

  const signatureField = fields.find((f) =>
    SIGNATURE_KEYS.has(f.fieldKey || ""),
  );
  const dedupedFields = useMemo(
    () => dedupeFields(fields, overviewValues),
    [fields, overviewValues],
  );
  const fieldSections = useMemo(() => {
    const sections = groupFieldsBySection(dedupedFields);
    const productName =
      productLabel && productLabel !== "—" ? productLabel : null;
    if (!productName) return sections;

    const productField: DetailField = {
      id: "synthetic-loan-product-name",
      fieldKey: "loanProductName",
      label: "Loan Product Name",
      value: productName,
      sectionName: "Loan Request",
      sectionSortOrder: 30,
      sortOrder: 0,
    };

    const hasProductField = (list: DetailField[]) =>
      list.some(
        (f) =>
          LOAN_PRODUCT_NAME_KEYS.has(f.fieldKey || "") ||
          /loan\s*product(\s*name)?/i.test(f.label || ""),
      );

    const loanRequest = sections.find((s) => s.name === "Loan Request");
    if (loanRequest) {
      if (!hasProductField(loanRequest.fields)) {
        loanRequest.fields = [productField, ...loanRequest.fields];
      }
      return sections;
    }

    return [
      ...sections,
      {
        id: "Loan Request",
        name: "Loan Request",
        sortOrder: 30,
        fields: [productField],
      },
    ].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }, [dedupedFields, productLabel]);

  const contacts = detail?.client?.contacts || [];
  const lenders: LenderItem[] = detail?.lenders || [];

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-[#13538A]" />
      </div>
    );
  }

  if (!detail) return null;

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1200px] space-y-6 pb-10 text-slate-900 dark:text-slate-100">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-[#13538A] via-[#1a6aad] to-[#2C92D5] p-6 text-white shadow-sm dark:border-slate-800 lg:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <Link
              to="/loan-pipeline"
              className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-white/80 transition hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Loan Pipeline
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {borrowerName}
              </h1>
              <span
                className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${getApplicationStatusColor(detail.status)} bg-white/95`}
              >
                {formatStatusLabel(detail.status)}
              </span>
            </div>
            <p className="mt-2 text-sm text-white/80">
              {detail.applicationNumber} · {productLabel}
              {detail.brokerOrg?.name ? ` · ${detail.brokerOrg.name}` : ""}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:w-[420px]">
            <div className="rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/20 backdrop-blur-sm">
              <p className="text-xs text-white/70">Amount</p>
              <p className="mt-1 text-lg font-semibold">
                {amount != null ? formatCompactAmount(amount) : "—"}
              </p>
            </div>
            <div className="rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/20 backdrop-blur-sm">
              <p className="text-xs text-white/70">Term</p>
              <p className="mt-1 text-lg font-semibold">{termLabel || "—"}</p>
            </div>
            <div className="col-span-2 rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/20 backdrop-blur-sm sm:col-span-1">
              <p className="text-xs text-white/70">Created</p>
              <p className="mt-1 text-lg font-semibold">
                {formatShortDate(detail.createdAt)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl bg-[#13538A] px-6 py-6 text-white shadow-sm">
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-6">
          {metrics.map((metric) => (
            <div key={metric.label} className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-white/70">
                {metric.label}
              </p>
              <p className="mt-2 truncate text-base font-bold tabular-nums">
                {metric.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      <SectionCard
        id="overview"
        title="Overview"
        description="Core application summary"
        open={Boolean(openSections.overview)}
        onToggle={toggleSection}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <InfoCard label="Application #" value={detail.applicationNumber} />
          <InfoCard label="Status" value={formatStatusLabel(detail.status)} />
          <InfoCard label="Loan Product" value={productLabel} />
          <InfoCard label="Borrower" value={borrowerName} />
          <InfoCard label="Entity Type" value={entityLabel} />
          <InfoCard label="Broker" value={detail.brokerOrg?.name || "—"} />
          <InfoCard
            label="Amount"
            value={amount != null ? formatCompactAmount(amount) : "—"}
          />
          <InfoCard label="Term (Months)" value={termLabel || "—"} />
          <InfoCard label="Purpose" value={purpose || "—"} />
        </div>
      </SectionCard>

      <SectionCard
        id="contacts"
        title="Borrower & Contacts"
        description={
          contacts.length
            ? `${contacts.length} contact${contacts.length === 1 ? "" : "s"}`
            : "Client profile"
        }
        open={Boolean(openSections.contacts)}
        onToggle={toggleSection}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <User className="h-4 w-4 text-[#13538A]" />
              Client Profile
            </div>
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-slate-500">Legal name: </span>
                <span className="font-medium">
                  {detail.client?.legalName &&
                  normalizeText(detail.client.legalName) !==
                    normalizeText(borrowerName)
                    ? detail.client.legalName
                    : detail.entityLabel &&
                        normalizeText(detail.entityLabel) !==
                          normalizeText(borrowerName)
                      ? detail.entityLabel
                      : "—"}
                </span>
              </p>
              <p>
                <span className="text-slate-500">Entity: </span>
                <span className="font-medium">{entityLabel || "—"}</span>
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {contacts.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700">
                No contacts on file.
              </p>
            ) : (
              contacts.map((contact: any) => (
                <div
                  key={contact.id || `${contact.email}-${contact.firstName}`}
                  className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {[contact.firstName, contact.lastName]
                          .filter(Boolean)
                          .join(" ") || "Contact"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {contact.email || "No email"}
                        {contact.phone ? ` · ${contact.phone}` : ""}
                      </p>
                    </div>
                    {contact.isPrimary ? (
                      <span className="rounded-full bg-[#13538A]/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-[#13538A]">
                        Primary
                      </span>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </SectionCard>

      {annualFinancialTable.columns.length > 0 &&
      annualFinancialTable.rows.length > 0 ? (
        <SectionCard
          id="annual-financial-performance"
          title="Annual Financial Performance"
          description="Year-by-year income, expenses, and calculated cash flow"
          open={Boolean(openSections["annual-financial-performance"])}
          onToggle={toggleSection}
        >
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="min-w-full text-sm">
              <thead className="bg-[#13538A]/5 text-slate-600 dark:bg-[#13538A]/20 dark:text-slate-300">
                <tr>
                  <th className="min-w-[230px] px-4 py-3 text-left font-semibold">
                    Financial Metric
                  </th>
                  {annualFinancialTable.columns.map((column, index) => (
                    <th
                      key={column.key}
                      className="min-w-[130px] px-4 py-3 text-right font-semibold"
                    >
                      {column.label}
                      {index === 0 ? (
                        <span className="ml-1 text-[10px] font-normal text-slate-400">
                          Interim
                        </span>
                      ) : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {annualFinancialTable.rows.map((row) => (
                  <tr
                    key={row.key}
                    className={
                      row.computed
                        ? "bg-blue-50/40 dark:bg-blue-500/5"
                        : "bg-white dark:bg-slate-900"
                    }
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-800 dark:text-slate-100">
                        {row.label}
                      </span>
                      {row.computed ? (
                        <span className="ml-2 rounded-full bg-[#13538A]/10 px-2 py-0.5 text-[10px] font-semibold text-[#13538A] dark:text-blue-300">
                          Calculated
                        </span>
                      ) : null}
                    </td>
                    {row.values.map((value, index) => (
                      <td
                        key={`${row.key}-${annualFinancialTable.columns[index].key}`}
                        className="px-4 py-3 text-right font-medium tabular-nums text-slate-700 dark:text-slate-200"
                      >
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Calculated values are derived from the submitted income, vacancy,
            expense, and debt-service figures.
          </p>
        </SectionCard>
      ) : null}

      {fieldSections.map((section) => (
        <SectionCard
          key={section.id}
          id={`field-${section.id}`}
          title={section.name}
          description={`${section.fields.length} field${section.fields.length === 1 ? "" : "s"}`}
          open={Boolean(openSections[`field-${section.id}`])}
          onToggle={toggleSection}
        >
          <div className="grid gap-4 md:grid-cols-2">
            {section.fields.map((field) => (
              <div
                key={field.id}
                className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60"
              >
                <p className="mb-1 text-xs text-slate-500">
                  {fieldDisplayLabel(field)}
                </p>
                <p className="break-words text-sm font-medium text-slate-900 dark:text-slate-100">
                  {formatDisplayValue(field.value, field.fieldKey)}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>
      ))}

      {(detail.financials || (detail.collaterals || []).length > 0) && (
        <SectionCard
          id="financials"
          title="Financials & Collateral"
          open={Boolean(openSections.financials)}
          onToggle={toggleSection}
        >
          <div className="space-y-6">
            {detail.financials ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <InfoCard
                  label="Annual Revenue"
                  value={
                    detail.financials.annualRevenue != null
                      ? formatCompactAmount(
                          Number(detail.financials.annualRevenue),
                        )
                      : "—"
                  }
                />
                <InfoCard
                  label="Net Income"
                  value={
                    detail.financials.netIncome != null
                      ? formatCompactAmount(Number(detail.financials.netIncome))
                      : "—"
                  }
                />
                <InfoCard
                  label="EBITDA"
                  value={
                    detail.financials.ebitda != null
                      ? formatCompactAmount(Number(detail.financials.ebitda))
                      : "—"
                  }
                />
                <InfoCard
                  label="Total Debt"
                  value={
                    detail.financials.totalDebt != null
                      ? formatCompactAmount(Number(detail.financials.totalDebt))
                      : "—"
                  }
                />
                <InfoCard
                  label="DSCR"
                  value={
                    detail.financials.dscr != null
                      ? Number(detail.financials.dscr).toFixed(2)
                      : "—"
                  }
                />
              </div>
            ) : null}

            {(detail.collaterals || []).length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {detail.collaterals.map((item: any) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60"
                  >
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      {item.collateralType || "Collateral"}
                    </p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      {item.description || "No description"}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      Value:{" "}
                      {item.valueEstimated != null
                        ? formatCompactAmount(Number(item.valueEstimated))
                        : "—"}
                      {item.lienPosition ? ` · Lien: ${item.lienPosition}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </SectionCard>
      )}

      <SectionCard
        id="lenders"
        title="Assigned Lenders"
        description={
          lenders.length
            ? `${lenders.length} lender${lenders.length === 1 ? "" : "s"} assigned`
            : "No lenders assigned yet"
        }
        open={Boolean(openSections.lenders)}
        onToggle={toggleSection}
      >
        {lenders.length === 0 ? (
          <p className="text-sm text-slate-500">No lenders assigned.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {lenders.map((lender) => (
              <div
                key={lender.lenderOrgId}
                className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#13538A]/10 text-[#13538A]">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      {lender.lenderName || "Lender"}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {formatLoanType(lender.lenderProduct)}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${getApplicationStatusColor(lender.lenderStatus)}`}
                      >
                        {formatStatusLabel(lender.lenderStatus)}
                      </span>
                      {lender.decision ? (
                        <span className="text-[10px] text-slate-500">
                          Decision: {formatStatusLabel(lender.decision)}
                        </span>
                      ) : null}
                      <span className="text-[10px] text-slate-400">
                        Sent {formatShortDate(lender.sentAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        id="documents"
        title="Documents"
        description={
          detail.documentUploads?.length
            ? `${detail.documentUploads.length} uploaded file${detail.documentUploads.length === 1 ? "" : "s"}`
            : "No documents uploaded"
        }
        open={Boolean(openSections.documents)}
        onToggle={toggleSection}
      >
        {!detail.documentUploads?.length ? (
          <p className="text-sm text-slate-500">No documents uploaded.</p>
        ) : (
          <div className="space-y-2">
            {detail.documentUploads.map((doc: any) => {
              const href = resolveFileUrl(doc.fileUrl);
              const documentName =
                doc.documentName ||
                doc.documentType?.name ||
                doc.fileName ||
                "Document";
              return (
                <div
                  key={doc.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                    <div className="min-w-0">
                      <p
                        className="truncate text-sm font-medium text-slate-800 dark:text-slate-100"
                        title={documentName}
                      >
                        {documentName}
                      </p>
                      <p className="truncate text-xs text-slate-500" title={doc.fileName}>
                        {doc.fileName && doc.fileName !== documentName
                          ? `${doc.fileName} · `
                          : ""}
                        {formatShortDate(doc.uploadedAt)}
                        {doc.isSignedOutput ? " · Signed" : ""}
                      </p>
                    </div>
                  </div>
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[#13538A] hover:underline"
                    >
                      View
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {signatureField?.value ? (
        <SectionCard
          id="signature"
          title="Borrower Signature"
          open={Boolean(openSections.signature)}
          onToggle={toggleSection}
        >
          <div className="flex justify-center">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <img
                src={String(signatureField.value)}
                alt="Borrower signature"
                className="h-28 max-w-full object-contain"
              />
            </div>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
