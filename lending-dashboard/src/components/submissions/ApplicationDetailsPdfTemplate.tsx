import {
  formatSubmissionFieldValue,
  getBorrowerDisplayNameFromFields,
  getSubmissionFieldLabel,
  groupSubmissionFieldsForDisplay,
  parseSubmissionFieldValue,
  type SubmissionDetailField,
} from "../../lib/submissionFieldUtils";
import {
  resolvePdfAssetUrl,
  resolvePdfLogoUrl,
  splitLongTextForPdf,
  type BrokerPdfProfile,
  type PdfBranding,
} from "../../lib/applicationDetailsPdf";

export type ApplicationDetailsPdfTemplateProps = {
  submissionDetail: {
    applicationNumber?: string | null;
    status?: string | null;
    borrowerName?: string | null;
  } | null;
  fields: SubmissionDetailField[];
  formatSubmissionStatus: (status?: string) => string;
  formatCompactAmount: (value: number) => string;
  loanAmount: number;
  ltv: number;
  dscr: number;
  interestRate: number;
  amortizationLabel: string;
  monthlyPaymentDisplay: string;
  submittedDate?: Date | null;
  brokerProfile: BrokerPdfProfile;
  loanProductName: string;
  branding: PdfBranding;
};

const BRAND = "#4C78F5";
const INK = "#0F172A";
const MUTED = "#64748B";
const LINE = "#E2E8F0";
const SOFT = "#F8FAFC";
const TABLE_HEAD = "#EEF3FF";

const FINANCIAL_ROW_ORDER = [
  "grossRevenue",
  "grossRentalIncome",
  "vacancyCreditLoss",
  "operatingExpenses",
  "effectiveGrossIncomeOverride",
  "noiOverride",
  "mortgageDebtService",
  "cashFlowAfterDebtOverride",
  "netIncome",
  "ebitda",
  "netProfit",
  "totalExistingDebt",
  "cashReserves",
  "dscr",
  "currentRatio",
];

const FINANCIAL_ROW_LABELS: Record<string, string> = {
  grossRevenue: "Gross Revenue",
  grossRentalIncome: "Gross Rental Income",
  vacancyCreditLoss: "Vacancy & Credit Loss",
  operatingExpenses: "Operating Expenses",
  effectiveGrossIncomeOverride: "Effective Gross Income",
  noiOverride: "Net Operating Income (NOI)",
  mortgageDebtService: "Mortgage / Debt Service",
  cashFlowAfterDebtOverride: "Cash Flow After Debt Service",
  netIncome: "Net Income",
  ebitda: "EBITDA",
  netProfit: "Net Profit",
  totalExistingDebt: "Total Existing Debt",
  cashReserves: "Cash Reserves",
  dscr: "Debt Service Coverage Ratio (DSCR)",
  currentRatio: "Current Ratio",
};

function buildTermsText(brandName: string): string {
  return `This loan application has been submitted through the ${brandName} commercial loan origination platform. All information provided herein is subject to verification, underwriting review, and final lender approval. The broker identified in this document is an independent third party and not an employee or agent of the lender. Submission of this application does not constitute a commitment to lend. This document and all associated materials are confidential and intended solely for authorized lending personnel.`;
}

function formatPdfDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return date.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatSignatureDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatGeneratedDate(): string {
  return new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function stripCoBorrowerPrefix(fieldKey: string) {
  return fieldKey.replace(/^coBorrower_\d+_/i, "");
}

function humanizeRowKey(key: string) {
  return key
    .replace(/Override$/i, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isLoanHighlightSection(title: string): boolean {
  const normalized = title.toLowerCase();
  return (
    normalized.includes("loan request") ||
    normalized.includes("loan details") ||
    (normalized.includes("loan") && normalized.includes("request"))
  );
}

function isFinancialSection(section: { id: string; title: string }) {
  const title = section.title.toLowerCase();
  return (
    section.id.includes("financial") ||
    title.includes("financial") ||
    title.includes("annual financial")
  );
}

const LONG_TEXT_FIELD_KEYS = new Set([
  "projectsummary",
  "exitstrategy",
  "purpose",
  "notes",
  "description",
  "comments",
  "projectdescription",
  "loandescription",
  "propertydescription",
  "businessdescription",
]);

function isLongTextField(field: SubmissionDetailField): boolean {
  const key = (field.fieldKey || "").toLowerCase();
  const label = getSubmissionFieldLabel(field).toLowerCase();
  const value = formatSubmissionFieldValue(field);

  if (LONG_TEXT_FIELD_KEYS.has(key)) return true;
  if (
    /summary|strategy|description|purpose|notes|comments|narrative|remarks/i.test(
      label,
    )
  ) {
    return true;
  }
  return value.length > 150;
}

type SectionLayoutItem =
  | { type: "row"; fields: SubmissionDetailField[] }
  | { type: "full"; field: SubmissionDetailField };

function buildSectionLayout(
  sectionFields: SubmissionDetailField[],
  columns: number,
): SectionLayoutItem[] {
  const items: SectionLayoutItem[] = [];
  let buffer: SubmissionDetailField[] = [];

  const flushBuffer = () => {
    if (!buffer.length) return;
    for (let i = 0; i < buffer.length; i += columns) {
      items.push({ type: "row", fields: buffer.slice(i, i + columns) });
    }
    buffer = [];
  };

  for (const field of sectionFields) {
    if (isLongTextField(field)) {
      flushBuffer();
      items.push({ type: "full", field });
    } else {
      buffer.push(field);
    }
  }

  flushBuffer();
  return items;
}

type FinancialMatrix = {
  columns: { key: string; label: string }[];
  rows: { key: string; label: string; values: Record<string, string> }[];
  leftoverFields: SubmissionDetailField[];
};

function buildYearColumnMap(fields: SubmissionDetailField[]) {
  const map = new Map<string, string>();
  for (const field of fields) {
    const bare = stripCoBorrowerPrefix(field.fieldKey || "");
    const match = bare.match(/^financialYear_(col\d+)$/i);
    if (!match) continue;
    const year = String(parseSubmissionFieldValue(field.value) ?? "").trim();
    if (!year) continue;
    const index = Number(match[1].replace(/col/i, ""));
    map.set(
      match[1].toLowerCase(),
      index === 0 ? `${year} (YTD)` : year,
    );
  }
  return map;
}

function buildFinancialMatrix(
  sectionFields: SubmissionDetailField[],
  allFields: SubmissionDetailField[],
): FinancialMatrix | null {
  const yearMap = buildYearColumnMap(allFields);
  const columnKeys = new Set<string>();
  const rowMap = new Map<string, Record<string, string>>();
  const leftoverFields: SubmissionDetailField[] = [];

  const matrixPattern =
    /^(financial|entityAnnual)_(.+)_col(\d+)(?:_computed)?$/i;

  for (const field of sectionFields) {
    const bare = stripCoBorrowerPrefix(field.fieldKey || "");
    const match = bare.match(matrixPattern);
    if (!match) {
      leftoverFields.push(field);
      continue;
    }

    const rowKey = match[2];
    const colKey = `col${match[3]}`.toLowerCase();
    columnKeys.add(colKey);
    if (!rowMap.has(rowKey)) rowMap.set(rowKey, {});
    rowMap.get(rowKey)![colKey] = formatSubmissionFieldValue(field);
  }

  if (!rowMap.size || !columnKeys.size) return null;

  const columns = Array.from(columnKeys)
    .sort((a, b) => {
      const ai = Number(a.replace(/col/i, ""));
      const bi = Number(b.replace(/col/i, ""));
      // Show years left-to-right as prior years then YTD (col0 last if present)
      if (ai === 0) return 1;
      if (bi === 0) return -1;
      return bi - ai;
    })
    .map((key) => ({
      key,
      label: yearMap.get(key) || (key === "col0" ? "YTD" : key.replace("col", "Year ")),
    }));

  const preferred = FINANCIAL_ROW_ORDER.filter((key) => rowMap.has(key));
  const remaining = Array.from(rowMap.keys()).filter(
    (key) => !FINANCIAL_ROW_ORDER.includes(key),
  );
  const orderedKeys = [...preferred, ...remaining];

  const rows = orderedKeys.map((key) => ({
    key,
    label: FINANCIAL_ROW_LABELS[key] || humanizeRowKey(key),
    values: rowMap.get(key) || {},
  }));

  return { columns, rows, leftoverFields };
}

function BrandLogo({
  logoUrl,
  brandName,
  height = 40,
  light = false,
}: {
  logoUrl: string | null;
  brandName: string;
  height?: number;
  light?: boolean;
}) {
  const resolvedLogoUrl = logoUrl ? resolvePdfLogoUrl(logoUrl) : null;

  if (resolvedLogoUrl) {
    return (
      <img
        src={resolvedLogoUrl}
        alt={brandName}
        {...(resolvedLogoUrl.startsWith("data:")
          ? {}
          : { crossOrigin: "anonymous" as const })}
        style={{
          height: `${height}px`,
          maxWidth: "180px",
          objectFit: "contain",
          display: "block",
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: `${height}px`,
        height: `${height}px`,
        borderRadius: "10px",
        background: light ? "rgba(255,255,255,0.2)" : `${BRAND}12`,
        border: light
          ? "1px solid rgba(255,255,255,0.25)"
          : `1px solid ${BRAND}22`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: `${Math.max(12, height * 0.42)}px`,
        fontWeight: 800,
        color: light ? "#ffffff" : BRAND,
      }}
    >
      {brandName.charAt(0).toUpperCase()}
    </div>
  );
}

function SectionHeading({
  index,
  title,
  accent = BRAND,
}: {
  index: number;
  title: string;
  accent?: string;
}) {
  return (
    <div
      data-pdf-block={`section-header-${index}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        marginBottom: "10px",
      }}
    >
      <span
        style={{
          fontSize: "8px",
          fontWeight: 800,
          letterSpacing: "0.12em",
          color: "#ffffff",
          background: accent,
          padding: "4px 9px",
          borderRadius: "999px",
          textTransform: "uppercase",
        }}
      >
        Section {index}
      </span>
      <span
        style={{
          fontSize: "14px",
          fontWeight: 700,
          color: INK,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </span>
    </div>
  );
}

function LongTextFieldCell({
  field,
  highlight,
  showTopBorder = true,
}: {
  field: SubmissionDetailField;
  highlight?: boolean;
  showTopBorder?: boolean;
}) {
  const label = getSubmissionFieldLabel(field).toUpperCase();
  const value = formatSubmissionFieldValue(field);
  const chunks = splitLongTextForPdf(value || "—");

  return (
    <>
      {chunks.map((chunk, chunkIndex) => (
        <div
          key={`${field.fieldKey}-${chunkIndex}`}
          data-pdf-block={`field-${field.fieldKey || label}-${chunkIndex}`}
          style={{
            padding: "12px 14px",
            borderTop:
              showTopBorder || chunkIndex > 0 ? `1px solid ${LINE}` : "none",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              fontSize: "8px",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: MUTED,
              marginBottom: "5px",
            }}
          >
            {chunkIndex === 0 ? label : `${label} (continued)`}
          </div>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: highlight ? BRAND : INK,
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
            }}
          >
            {chunk}
          </div>
        </div>
      ))}
    </>
  );
}

function FieldCell({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div style={{ padding: "11px 14px", minWidth: 0 }}>
      <div
        style={{
          fontSize: "8px",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: MUTED,
          marginBottom: "4px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "12px",
          fontWeight: 600,
          color: highlight ? BRAND : INK,
          lineHeight: 1.45,
          wordBreak: "break-word",
        }}
      >
        {value || "—"}
      </div>
    </div>
  );
}

function SectionFieldsGrid({
  sectionFields,
  columns = 3,
}: {
  sectionFields: SubmissionDetailField[];
  columns?: 2 | 3 | 4;
}) {
  const widthPct = `${100 / columns}%`;
  const layoutItems = buildSectionLayout(sectionFields, columns);

  return (
    <div>
      {layoutItems.map((item, itemIndex) => {
        if (item.type === "full") {
          return (
            <LongTextFieldCell
              key={`${item.field.fieldKey}-${item.field.fieldId || ""}`}
              field={item.field}
              showTopBorder={itemIndex > 0}
              highlight={
                item.field.fieldKey === "amountRequested" ||
                /amount/i.test(getSubmissionFieldLabel(item.field))
              }
            />
          );
        }

        const row = item.fields;

        return (
          <div
            key={`row-${itemIndex}`}
            data-pdf-block={`row-${row.map((f) => f.fieldKey).join("-")}`}
            style={{
              display: "flex",
              flexWrap: "nowrap",
              alignItems: "flex-start",
              borderBottom:
                itemIndex < layoutItems.length - 1 ? `1px solid ${LINE}` : "none",
            }}
          >
            {row.map((field) => (
              <div
                key={`${field.fieldKey}-${field.fieldId || ""}`}
                style={{ width: widthPct, boxSizing: "border-box", flexShrink: 0 }}
              >
                <FieldCell
                  label={getSubmissionFieldLabel(field).toUpperCase()}
                  value={formatSubmissionFieldValue(field)}
                  highlight={
                    field.fieldKey === "amountRequested" ||
                    /amount/i.test(getSubmissionFieldLabel(field))
                  }
                />
              </div>
            ))}
            {row.length < columns
              ? Array.from({ length: columns - row.length }).map((_, i) => (
                  <div
                    key={`pad-${i}`}
                    style={{
                      width: widthPct,
                      boxSizing: "border-box",
                      flexShrink: 0,
                    }}
                  />
                ))
              : null}
          </div>
        );
      })}
    </div>
  );
}

function FinancialSummaryTable({ matrix }: { matrix: FinancialMatrix }) {
  return (
    <div
      data-pdf-block="financial-summary-table"
      style={{
        border: `1px solid ${LINE}`,
        borderRadius: "12px",
        overflow: "hidden",
        background: "#ffffff",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          tableLayout: "fixed",
        }}
      >
        <thead>
          <tr style={{ background: TABLE_HEAD }}>
            <th
              style={{
                textAlign: "left",
                padding: "11px 14px",
                fontSize: "8px",
                fontWeight: 800,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: BRAND,
                borderBottom: `1px solid ${LINE}`,
                width: "34%",
              }}
            >
              Financial Metric
            </th>
            {matrix.columns.map((column) => (
              <th
                key={column.key}
                style={{
                  textAlign: "right",
                  padding: "11px 14px",
                  fontSize: "8px",
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: BRAND,
                  borderBottom: `1px solid ${LINE}`,
                }}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((row, rowIndex) => (
            <tr
              key={row.key}
              style={{
                background: rowIndex % 2 === 0 ? "#ffffff" : SOFT,
              }}
            >
              <td
                style={{
                  padding: "10px 14px",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: INK,
                  borderBottom: `1px solid ${LINE}`,
                }}
              >
                {row.label}
              </td>
              {matrix.columns.map((column) => (
                <td
                  key={`${row.key}-${column.key}`}
                  style={{
                    padding: "10px 14px",
                    fontSize: "11px",
                    fontWeight: 700,
                    color: INK,
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    borderBottom: `1px solid ${LINE}`,
                  }}
                >
                  {row.values[column.key] || "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        border: `1px solid ${LINE}`,
        borderRadius: "10px",
        background: "#ffffff",
        padding: "10px 12px",
      }}
    >
      <div
        style={{
          fontSize: "7px",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: MUTED,
          marginBottom: "4px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "14px",
          fontWeight: 700,
          color: INK,
          lineHeight: 1.2,
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: "0 2px" }}>
      <div
        style={{
          fontSize: "8px",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: MUTED,
          marginBottom: "3px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "11px",
          fontWeight: 600,
          color: INK,
          lineHeight: 1.4,
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default function ApplicationDetailsPdfTemplate({
  submissionDetail,
  fields,
  formatSubmissionStatus,
  formatCompactAmount,
  loanAmount,
  ltv,
  dscr,
  interestRate,
  amortizationLabel,
  monthlyPaymentDisplay,
  submittedDate,
  brokerProfile,
  loanProductName,
  branding,
}: ApplicationDetailsPdfTemplateProps) {
  const { sections, signatureField } = groupSubmissionFieldsForDisplay(fields);
  const borrowerName = getBorrowerDisplayNameFromFields(
    fields,
    submissionDetail?.borrowerName,
  );
  const applicationNumber =
    submissionDetail?.applicationNumber || "Application";
  const pipelineStage = formatSubmissionStatus(
    submissionDetail?.status ?? undefined,
  );
  const signatureSrc = signatureField?.value
    ? resolvePdfAssetUrl(String(parseSubmissionFieldValue(signatureField.value)))
    : null;

  const brandName = branding.brandName || "Loan Automation";
  const logoUrl = branding.logoUrl;
  const accent = branding.primaryColor || BRAND;

  let sectionCounter = 0;

  return (
    <div
      data-application-details-pdf="true"
      style={{
        width: "794px",
        background: "#ffffff",
        color: INK,
        fontFamily:
          "Inter, 'Segoe UI', Arial, Helvetica, sans-serif",
        position: "relative",
      }}
    >
      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Header — white professional */}
        <div
          data-pdf-block="header"
          style={{
            padding: "24px 28px 18px",
            borderBottom: `1px solid ${LINE}`,
            background: "#ffffff",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "20px",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "16px",
                }}
              >
                <BrandLogo logoUrl={logoUrl} brandName={brandName} height={40} />
                <div>
                  <div
                    style={{
                      fontSize: "15px",
                      fontWeight: 700,
                      color: INK,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {brandName}
                  </div>
                  <div
                    style={{
                      marginTop: "2px",
                      fontSize: "9px",
                      fontWeight: 700,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: accent,
                    }}
                  >
                    Commercial Loan Application
                  </div>
                </div>
              </div>

              <div
                style={{
                  fontSize: "22px",
                  fontWeight: 700,
                  lineHeight: 1.2,
                  letterSpacing: "-0.02em",
                  color: INK,
                }}
              >
                Loan Application Summary
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: MUTED,
                  marginTop: "5px",
                }}
              >
                Complete application details — verified submission record
              </div>
            </div>

            <div
              style={{
                background: SOFT,
                border: `1px solid ${LINE}`,
                borderRadius: "12px",
                padding: "12px 14px",
                minWidth: "200px",
              }}
            >
              <div
                style={{
                  fontSize: "9px",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: MUTED,
                  marginBottom: "5px",
                }}
              >
                Application ID
              </div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: accent }}>
                #{applicationNumber}
              </div>
              <div
                style={{
                  marginTop: "10px",
                  fontSize: "10px",
                  lineHeight: 1.6,
                  color: MUTED,
                }}
              >
                <div>{formatPdfDate(submittedDate)}</div>
                <div style={{ marginTop: "3px" }}>
                  Status:{" "}
                  <span style={{ color: INK, fontWeight: 600 }}>
                    {pipelineStage}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Meta strip */}
        <div
          data-pdf-block="meta"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "12px",
            padding: "14px 28px",
            background: SOFT,
            borderBottom: `1px solid ${LINE}`,
          }}
        >
          <MetaItem label="Borrower" value={borrowerName} />
          <MetaItem label="Loan Product" value={loanProductName} />
          <MetaItem
            label="Broker"
            value={`${brokerProfile.name} · ${brokerProfile.organizationName}`}
          />
          <MetaItem label="Broker Contact" value={brokerProfile.email} />
        </div>

        {/* Metrics — white cards */}
        <div data-pdf-block="metrics" style={{ padding: "14px 28px 0" }}>
          <div style={{ display: "flex", gap: "8px" }}>
            {[
              {
                label: "Loan Amount",
                value: formatCompactAmount(loanAmount),
              },
              {
                label: "Interest Rate",
                value: interestRate ? `${interestRate.toFixed(2)}%` : "—",
              },
              {
                label: "Amortization",
                value: amortizationLabel || "—",
              },
              {
                label: "Monthly P&I",
                value: monthlyPaymentDisplay || "—",
              },
              {
                label: "LTV Ratio",
                value: ltv ? `${ltv.toFixed(1)}%` : "—",
              },
              {
                label: "DSCR",
                value: dscr ? `${dscr.toFixed(2)}x` : "—",
              },
            ].map((metric) => (
              <MetricCard
                key={metric.label}
                label={metric.label}
                value={metric.value}
              />
            ))}
          </div>
        </div>

        {/* Sections */}
        <div style={{ padding: "16px 28px 12px" }}>
          {sections.map((section) => {
            sectionCounter += 1;
            const index = sectionCounter;
            const highlight = isLoanHighlightSection(section.title);
            const financial = isFinancialSection(section);
            const matrix = financial
              ? buildFinancialMatrix(section.fields, fields)
              : null;

            const leftover = matrix?.leftoverFields || [];
            const gridFields = matrix ? leftover : section.fields;
            const columns =
              gridFields.length <= 4
                ? 2
                : gridFields.some((f) =>
                      /description|purpose|address|notes|summary|strategy/i.test(
                        getSubmissionFieldLabel(f),
                      ),
                    )
                  ? 2
                  : 3;

            return (
              <div
                key={section.id}
                style={{ marginBottom: "16px" }}
              >
                <SectionHeading
                  index={index}
                  title={
                    financial && matrix
                      ? "Financial Summary"
                      : section.title
                  }
                  accent={accent}
                />

                {matrix ? (
                  <div style={{ marginBottom: leftover.length ? "10px" : 0 }}>
                    <FinancialSummaryTable matrix={matrix} />
                  </div>
                ) : null}

                {gridFields.length > 0 ? (
                  <div
                    style={{
                      border: `1px solid ${LINE}`,
                      borderRadius: "12px",
                      overflow: "visible",
                      background: highlight ? "#FFFBEB" : "#ffffff",
                    }}
                  >
                    <SectionFieldsGrid
                      sectionFields={gridFields}
                      columns={columns as 2 | 3 | 4}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}

          {/* Broker Information */}
          <div
            data-pdf-block="broker-info"
            style={{ marginBottom: "16px", pageBreakInside: "avoid" }}
          >
            <SectionHeading
              index={sectionCounter + 1}
              title="Broker Information"
              accent={accent}
            />
            <div
              style={{
                border: `1px solid ${LINE}`,
                borderRadius: "12px",
                overflow: "hidden",
                background: "#ffffff",
              }}
            >
              <SectionFieldsGrid
                sectionFields={[
                  {
                    fieldKey: "brokerageName",
                    label: "Brokerage Name",
                    value: brokerProfile.organizationName,
                  },
                  {
                    fieldKey: "brokerName",
                    label: "Broker Name",
                    value: brokerProfile.name,
                  },
                  {
                    fieldKey: "brokerNmls",
                    label: "NMLS ID",
                    value: brokerProfile.licenseNumber,
                  },
                  {
                    fieldKey: "brokerPhone",
                    label: "Broker Phone",
                    value: brokerProfile.phone,
                  },
                  {
                    fieldKey: "brokerEmail",
                    label: "Broker Email",
                    value: brokerProfile.email,
                  },
                  {
                    fieldKey: "brokerAddress",
                    label: "Broker Address",
                    value: brokerProfile.address,
                  },
                ]}
                columns={3}
              />
            </div>
          </div>

          {/* Terms */}
          <div
            data-pdf-block="terms"
            style={{ marginBottom: "14px", pageBreakInside: "avoid" }}
          >
            <div
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: INK,
                marginBottom: "8px",
              }}
            >
              Terms & Acknowledgement
            </div>
            <div
              style={{
                background: SOFT,
                border: `1px solid ${LINE}`,
                borderRadius: "12px",
                padding: "14px 16px",
                fontSize: "10px",
                lineHeight: 1.7,
                color: "#475569",
                textAlign: "justify",
              }}
            >
              {buildTermsText(brandName)}
            </div>
          </div>

          {/* Borrower Signature */}
          <div
            data-pdf-block="signature"
            style={{ marginBottom: "8px", pageBreakInside: "avoid" }}
          >
            <div
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: INK,
                marginBottom: "10px",
              }}
            >
              Borrower Signature
            </div>
            <div
              style={{
                border: `1px solid ${LINE}`,
                borderRadius: "12px",
                padding: "18px 20px",
                maxWidth: "420px",
                background: "#ffffff",
              }}
            >
              <div
                style={{
                  fontSize: "8px",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: MUTED,
                  marginBottom: "10px",
                }}
              >
                Authorised Borrower Signature
              </div>
              {signatureSrc ? (
                <img
                  src={signatureSrc}
                  alt="Borrower signature"
                  style={{
                    height: "64px",
                    maxWidth: "100%",
                    objectFit: "contain",
                    marginBottom: "10px",
                    display: "block",
                  }}
                />
              ) : (
                <div
                  style={{
                    fontFamily: "Georgia, 'Times New Roman', serif",
                    fontStyle: "italic",
                    fontSize: "24px",
                    color: INK,
                    marginBottom: "10px",
                    minHeight: "34px",
                  }}
                >
                  {borrowerName}
                </div>
              )}
              <div
                style={{
                  borderTop: `1px solid ${LINE}`,
                  paddingTop: "8px",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#334155",
                }}
              >
                {borrowerName}
              </div>
              <div style={{ marginTop: "12px" }}>
                <div
                  style={{
                    fontSize: "8px",
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: MUTED,
                    marginBottom: "3px",
                  }}
                >
                  Date Signed
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: INK,
                  }}
                >
                  {formatSignatureDate(submittedDate)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer — white */}
        <div
          data-pdf-block="footer"
          style={{
            borderTop: `1px solid ${LINE}`,
            background: SOFT,
            color: MUTED,
            padding: "12px 28px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "9px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <BrandLogo logoUrl={logoUrl} brandName={brandName} height={20} />
            <span style={{ fontWeight: 600, color: INK }}>{brandName}</span>
          </div>
          <div style={{ textAlign: "right", lineHeight: 1.5 }}>
            <div style={{ fontWeight: 700, color: accent, letterSpacing: "0.08em" }}>
              CONFIDENTIAL
            </div>
            <div>
              Application #{applicationNumber} · Generated {formatGeneratedDate()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
