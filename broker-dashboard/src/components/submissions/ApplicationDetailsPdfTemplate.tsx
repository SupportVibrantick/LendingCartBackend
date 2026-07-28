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
  type BrokerPdfBranding,
  type BrokerPdfProfile,
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
  branding: BrokerPdfBranding;
};

const SECTION_ACCENTS = [
  "#13538A",
  "#0F766E",
  "#B45309",
  "#1D4ED8",
  "#6D28D9",
  "#BE185D",
];

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

function isLoanHighlightSection(title: string): boolean {
  const normalized = title.toLowerCase();
  return (
    normalized.includes("loan request") ||
    normalized.includes("loan details") ||
    (normalized.includes("loan") && normalized.includes("request"))
  );
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

function BrandLogo({
  logoUrl,
  brandName,
  height = 40,
}: {
  logoUrl: string | null;
  brandName: string;
  height?: number;
}) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={brandName}
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
        width: "40px",
        height: "40px",
        borderRadius: "10px",
        background: "rgba(255,255,255,0.2)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "18px",
        fontWeight: 800,
        color: "#ffffff",
      }}
    >
      {brandName.charAt(0).toUpperCase()}
    </div>
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
    <div style={{ padding: "12px 16px", minWidth: 0 }}>
      <div
        style={{
          fontSize: "8px",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "#64748B",
          marginBottom: "5px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "12px",
          fontWeight: 600,
          color: highlight ? "#13538A" : "#0F172A",
          lineHeight: 1.5,
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

  return (
    <div>
      {chunkArray(sectionFields, columns).map((row, rowIndex) => (
        <div
          key={`row-${rowIndex}`}
          style={{
            display: "flex",
            flexWrap: "wrap",
            borderBottom:
              rowIndex < Math.ceil(sectionFields.length / columns) - 1
                ? "1px solid #E8EDF3"
                : "none",
          }}
        >
          {row.map((field) => (
            <div
              key={`${field.fieldKey}-${field.fieldId || ""}`}
              style={{ width: widthPct, boxSizing: "border-box" }}
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
                  style={{ width: widthPct, boxSizing: "border-box" }}
                />
              ))
            : null}
        </div>
      ))}
    </div>
  );
}

function MetricCell({
  label,
  value,
  accent,
  showDivider,
}: {
  label: string;
  value: string;
  accent?: boolean;
  showDivider?: boolean;
}) {
  return (
    <div
      style={{
        flex: 1,
        padding: "10px 6px",
        textAlign: "center",
        borderRight: showDivider ? "1px solid rgba(255,255,255,0.15)" : "none",
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: "15px",
          fontWeight: 700,
          color: accent ? "#FCD34D" : "#ffffff",
          lineHeight: 1.3,
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
      <div
        style={{
          marginTop: "4px",
          fontSize: "7px",
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.55)",
          lineHeight: 1.3,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: "0 4px" }}>
      <div
        style={{
          fontSize: "8px",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "#64748B",
          marginBottom: "3px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "11px",
          fontWeight: 600,
          color: "#0F172A",
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

  const { brandName, logoUrl, primaryColor, secondaryColor } = branding;
  const headerGradient = `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`;

  return (
    <div
      data-application-details-pdf="true"
      style={{
        width: "794px",
        background: "#ffffff",
        color: "#0F172A",
        fontFamily: "'Segoe UI', Arial, Helvetica, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        <div
          style={{
            transform: "rotate(-28deg)",
            fontSize: "72px",
            fontWeight: 800,
            color: "rgba(19,83,138,0.04)",
            letterSpacing: "0.14em",
            whiteSpace: "nowrap",
            textTransform: "uppercase",
          }}
        >
          {brandName}
        </div>
      </div>

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Header */}
        <div
          style={{
            background: headerGradient,
            color: "#ffffff",
            padding: "26px 32px 22px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "24px",
            }}
          >
            <div style={{ flex: 1 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  marginBottom: "20px",
                }}
              >
                <BrandLogo logoUrl={logoUrl} brandName={brandName} height={44} />
                <div
                  style={{
                    fontSize: "16px",
                    fontWeight: 700,
                    letterSpacing: "0.01em",
                  }}
                >
                  {brandName}
                </div>
              </div>
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: 700,
                  lineHeight: 1.25,
                  letterSpacing: "-0.01em",
                }}
              >
                Loan Application Summary
              </div>
              <div
                style={{
                  fontSize: "11px",
                  opacity: 0.9,
                  marginTop: "6px",
                }}
              >
                Complete application details — verified submission record
              </div>
            </div>

            <div
              style={{
                background: "rgba(255,255,255,0.12)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "12px",
                padding: "14px 16px",
                minWidth: "210px",
              }}
            >
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  opacity: 0.8,
                  marginBottom: "6px",
                }}
              >
                Application ID
              </div>
              <div style={{ fontSize: "13px", fontWeight: 700 }}>
                #{applicationNumber}
              </div>
              <div
                style={{
                  marginTop: "10px",
                  fontSize: "10px",
                  lineHeight: 1.65,
                  opacity: 0.92,
                }}
              >
                <div>{formatPdfDate(submittedDate)}</div>
                <div style={{ marginTop: "4px" }}>Status: {pipelineStage}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Meta strip */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "12px",
            padding: "16px 32px",
            background: "#F8FAFC",
            borderBottom: "1px solid #E2E8F0",
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

        {/* Metrics bar */}
        <div style={{ padding: "14px 32px 0" }}>
          <div
            style={{
              background: "linear-gradient(135deg, #0F2744 0%, #13538A 55%, #1a6cb0 100%)",
              borderRadius: "12px",
              padding: "4px 6px",
              color: "#ffffff",
              boxShadow: "0 4px 16px rgba(19,83,138,0.12)",
            }}
          >
            <div style={{ display: "flex", alignItems: "stretch" }}>
              {[
                {
                  label: "Loan Amount",
                  value: formatCompactAmount(loanAmount),
                  accent: false,
                },
                {
                  label: "Interest Rate",
                  value: interestRate ? `${interestRate.toFixed(2)}%` : "—",
                  accent: true,
                },
                {
                  label: "Amortization",
                  value: amortizationLabel || "—",
                  accent: false,
                },
                {
                  label: "Monthly P&I",
                  value: monthlyPaymentDisplay || "—",
                  accent: false,
                },
                {
                  label: "LTV Ratio",
                  value: ltv ? `${ltv.toFixed(1)}%` : "—",
                  accent: true,
                },
                {
                  label: "DSCR",
                  value: dscr ? `${dscr.toFixed(2)}x` : "—",
                  accent: true,
                },
              ].map((metric, index, arr) => (
                <MetricCell
                  key={metric.label}
                  label={metric.label}
                  value={metric.value}
                  accent={metric.accent}
                  showDivider={index < arr.length - 1}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Sections */}
        <div style={{ padding: "16px 32px 16px" }}>
          {sections.map((section, index) => {
            const accent = SECTION_ACCENTS[index % SECTION_ACCENTS.length];
            const highlight = isLoanHighlightSection(section.title);
            const columns =
              section.fields.length <= 4
                ? 2
                : section.fields.some((f) =>
                      /description|purpose|address|notes/i.test(
                        getSubmissionFieldLabel(f),
                      ),
                    )
                  ? 2
                  : 3;

            return (
              <div
                key={section.id}
                data-pdf-block={`section-${index + 1}`}
                style={{
                  marginBottom: "14px",
                  pageBreakInside: "avoid",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    marginBottom: "10px",
                    paddingBottom: "8px",
                    borderBottom: "2px solid #E8EDF3",
                  }}
                >
                  <div
                    style={{
                      width: "4px",
                      height: "22px",
                      borderRadius: "2px",
                      background: accent,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: "9px",
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      color: accent,
                      background: `${accent}12`,
                      padding: "3px 9px",
                      borderRadius: "4px",
                    }}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span
                    style={{
                      fontSize: "14px",
                      fontWeight: 700,
                      color: "#0F172A",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {section.title}
                  </span>
                </div>

                <div
                  style={{
                    border: "1px solid #E2E8F0",
                    borderRadius: "10px",
                    overflow: "hidden",
                    background: highlight ? "#FFFBEB" : "#ffffff",
                    boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
                  }}
                >
                  <SectionFieldsGrid
                    sectionFields={section.fields}
                    columns={columns as 2 | 3 | 4}
                  />
                </div>
              </div>
            );
          })}

          {/* Broker Information */}
          <div
            data-pdf-block="broker-info"
            style={{ marginBottom: "14px", pageBreakInside: "avoid" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "10px",
                paddingBottom: "8px",
                borderBottom: "2px solid #E8EDF3",
              }}
            >
              <div
                style={{
                  width: "4px",
                  height: "22px",
                  borderRadius: "2px",
                  background: primaryColor,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#0F172A",
                }}
              >
                Broker Information
              </span>
            </div>
            <div
              style={{
                border: "1px solid #E2E8F0",
                borderRadius: "10px",
                overflow: "hidden",
                boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
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
                    label: "NMLS / License #",
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
                color: "#0F172A",
                marginBottom: "10px",
              }}
            >
              Terms & Acknowledgement
            </div>
            <div
              style={{
                background: "#F1F5F9",
                border: "1px solid #E2E8F0",
                borderRadius: "10px",
                padding: "16px 18px",
                fontSize: "10px",
                lineHeight: 1.75,
                color: "#475569",
                textAlign: "justify",
              }}
            >
              {buildTermsText(brandName)}
            </div>
          </div>

          {/* Borrower Signature only */}
          <div
            data-pdf-block="signature"
            style={{ marginBottom: "12px", pageBreakInside: "avoid" }}
          >
            <div
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "#0F172A",
                marginBottom: "12px",
              }}
            >
              Borrower Signature
            </div>
            <div
              style={{
                border: "1px solid #E2E8F0",
                borderRadius: "10px",
                padding: "20px 24px",
                maxWidth: "420px",
                boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
              }}
            >
              <div
                style={{
                  fontSize: "8px",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "#64748B",
                  marginBottom: "12px",
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
                    marginBottom: "12px",
                    display: "block",
                  }}
                />
              ) : (
                <div
                  style={{
                    fontFamily: "Georgia, 'Times New Roman', serif",
                    fontStyle: "italic",
                    fontSize: "26px",
                    color: "#0F172A",
                    marginBottom: "12px",
                    minHeight: "36px",
                  }}
                >
                  {borrowerName}
                </div>
              )}
              <div
                style={{
                  borderTop: "1px solid #CBD5E1",
                  paddingTop: "10px",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#334155",
                }}
              >
                {borrowerName}
              </div>
              <div style={{ marginTop: "14px" }}>
                <div
                  style={{
                    fontSize: "8px",
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "#64748B",
                    marginBottom: "3px",
                  }}
                >
                  Date Signed
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#0F172A",
                  }}
                >
                  {formatSignatureDate(submittedDate)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          data-pdf-block="footer"
          style={{
            background: headerGradient,
            color: "#ffffff",
            padding: "14px 32px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "9px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <BrandLogo logoUrl={logoUrl} brandName={brandName} height={22} />
            <span style={{ fontWeight: 600, opacity: 0.95 }}>{brandName}</span>
          </div>
          <div style={{ opacity: 0.88, textAlign: "right", lineHeight: 1.5 }}>
            <div>CONFIDENTIAL</div>
            <div>
              Application #{applicationNumber} · Generated {formatGeneratedDate()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
