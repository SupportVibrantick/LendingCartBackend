import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Building2,
  Calendar,
  FileText,
  Loader2,
  Mail,
  Package,
  Phone,
  User,
  X,
} from "lucide-react";
import {
  buildLoanProductDetailFields,
  formatLoanProductCode,
  formatLoanProductName,
} from "../../lib/loanProductListDisplay";
import { resolveLenderOfferedProductCode } from "../../lib/canonicalLoanProducts";

type LenderSummary = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  status?: string;
  createdAt?: string;
  brokerName?: string;
  brokerOrgId?: string;
  adminFirstName?: string;
  adminLastName?: string;
  adminEmail?: string;
  adminStatus?: string;
  profileImage?: string | null;
};

type AssignedProductDetail = {
  id: string;
  loanProductCode?: string;
  loanProduct?: { name?: string; code?: string; description?: string };
  isActive: boolean;
  createdAt?: string;
  criteriaNotes?: string | null;
  statesSupported?: string[];
  businessTypes?: Array<{ name?: string; subTypes?: string[] }>;
  propertyTypes?: Array<{ type?: string; subTypes?: string[] }>;
  equipmentTypes?: string[];
  documents?: ProductDocument[];
  [key: string]: unknown;
};

type ProductDocument = {
  id?: string;
  requirementId?: string;
  documentTypeId?: string;
  documentName?: string | null;
  documentCode?: string | null;
  name?: string | null;
  isRequired?: boolean;
  isCustom?: boolean;
};

type LenderDetailsModalProps = {
  lender: LenderSummary | null;
  apiBase: string;
  onClose: () => void;
};

function getAuthHeaders(): Record<string, string> {
  const token = sessionStorage.getItem("admin_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function statusClass(status?: string) {
  switch (status) {
    case "ACTIVE":
      return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/40";
    case "INACTIVE":
      return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-300 dark:border-yellow-500/40";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-slate-600/30 dark:text-slate-100 dark:border-slate-500";
  }
}

function formatCurrencyAmount(amount?: number | null): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return "—";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function normalizeArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter(Boolean).map(String);
  if (typeof val === "string" && val.trim()) {
    return val.split(",").map((v) => v.trim()).filter(Boolean);
  }
  return [];
}

function mapDocuments(raw: unknown): ProductDocument[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((doc: Record<string, unknown>) => {
      const documentTypeId =
        (doc.documentTypeId as string) ||
        (doc.documentType as { id?: string } | undefined)?.id ||
        (doc.id as string);
      if (!documentTypeId) return null;

      return {
        id: documentTypeId,
        requirementId: doc.requirementId as string | undefined,
        documentTypeId,
        documentName:
          (doc.documentName as string) ||
          (doc.documentType as { name?: string } | undefined)?.name ||
          (doc.name as string) ||
          null,
        documentCode:
          (doc.documentCode as string) ||
          (doc.documentType as { code?: string } | undefined)?.code ||
          null,
        name:
          (doc.documentName as string) ||
          (doc.documentType as { name?: string } | undefined)?.name ||
          (doc.name as string) ||
          null,
        isRequired: doc.isRequired as boolean | undefined,
        isCustom: doc.isCustom as boolean | undefined,
      };
    })
    .filter(Boolean) as ProductDocument[];
}

function mapProductRow(raw: Record<string, unknown>): AssignedProductDetail {
  const loanProduct = raw.loanProduct as AssignedProductDetail["loanProduct"];
  const loanProductCode =
    (raw.loanProductCode as string) || loanProduct?.code || "";

  return {
    ...raw,
    id: String(raw.id),
    loanProductCode: resolveLenderOfferedProductCode(loanProductCode),
    loanProduct,
    isActive: Boolean(raw.isActive),
    createdAt: raw.createdAt as string | undefined,
    criteriaNotes: raw.criteriaNotes as string | null,
    statesSupported: normalizeArray(raw.statesSupported),
    businessTypes: Array.isArray(raw.businessTypes) ? raw.businessTypes : [],
    propertyTypes: Array.isArray(raw.propertyTypes) ? raw.propertyTypes : [],
    equipmentTypes: normalizeArray(raw.equipmentTypes),
    documents: mapDocuments(raw.documents ?? raw.lenderDocumentRequirements),
  };
}

function FieldCard({
  label,
  value,
  fullWidth,
}: {
  label: string;
  value: unknown;
  fullWidth?: boolean;
}) {
  const display =
    value === null || value === undefined || value === "" ? "—" : String(value);
  return (
    <div className={`space-y-1 ${fullWidth ? "sm:col-span-2 lg:col-span-3" : ""}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 whitespace-pre-wrap">
        {display}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </h3>
      {children}
    </section>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-800/40">
      <div className="mt-0.5 text-slate-400">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          {label}
        </p>
        <p className="mt-0.5 break-all text-sm text-slate-800 dark:text-slate-100">
          {value?.trim() || "—"}
        </p>
      </div>
    </div>
  );
}

function AssignedProductCard({ product }: { product: AssignedProductDetail }) {
  const programName = formatLoanProductName(product);
  const programCode = formatLoanProductCode(product);
  const criteriaFields = buildLoanProductDetailFields(
    product,
    formatCurrencyAmount,
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/30">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-700">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 dark:text-white">
            {programName !== "-" ? programName : programCode}
          </p>
          <p className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-500">
            {programCode}
          </p>
          {product.loanProduct?.description ? (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {product.loanProduct.description}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
              product.isActive
                ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400"
                : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400"
            }`}
          >
            {product.isActive ? "Active" : "Inactive"}
          </span>
          {product.createdAt ? (
            <span className="text-[10px] text-slate-400">
              Assigned {new Date(product.createdAt).toLocaleDateString()}
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {criteriaFields.map((field, index) => (
          <FieldCard
            key={`${field.label}-${index}`}
            label={field.label}
            value={field.value}
            fullWidth={field.fullWidth}
          />
        ))}
      </div>

      {product.statesSupported?.length ? (
        <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-700">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            States Supported ({product.statesSupported.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {product.statesSupported.map((state) => (
              <span
                key={state}
                className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700 dark:bg-slate-700 dark:text-slate-200"
              >
                {state}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {product.businessTypes?.length ? (
        <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-700">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Business Types
          </p>
          <div className="flex flex-wrap gap-2">
            {product.businessTypes.map((item, idx) => (
              <div
                key={`${item.name}-${idx}`}
                className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs dark:border-blue-500/20 dark:bg-blue-500/10"
              >
                <span className="font-medium text-blue-700 dark:text-blue-300">
                  {item.name}
                </span>
                {item.subTypes?.length ? (
                  <span className="ml-1 text-slate-500">
                    ({item.subTypes.join(", ")})
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {product.propertyTypes?.length ? (
        <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-700">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Property Types
          </p>
          <div className="flex flex-wrap gap-2">
            {product.propertyTypes.map((item, idx) => (
              <div
                key={`${item.type}-${idx}`}
                className="rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-xs dark:border-green-500/20 dark:bg-green-500/10"
              >
                <span className="font-medium text-green-700 dark:text-green-300">
                  {item.type}
                </span>
                {item.subTypes?.length ? (
                  <span className="ml-1 text-slate-500">
                    ({item.subTypes.join(", ")})
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {product.equipmentTypes?.length ? (
        <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-700">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Equipment Types
          </p>
          <div className="flex flex-wrap gap-1.5">
            {product.equipmentTypes.map((type) => (
              <span
                key={type}
                className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[10px] text-purple-700 dark:bg-purple-500/15 dark:text-purple-300"
              >
                {type}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-700">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Documents ({product.documents?.length || 0})
        </p>
        {product.documents?.length ? (
          <div className="flex flex-wrap gap-2">
            {product.documents.map((doc) => (
              <span
                key={doc.documentTypeId || doc.id}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-100 bg-amber-50 px-3 py-1.5 text-xs text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"
              >
                <FileText size={12} className="shrink-0 opacity-70" />
                <span>
                  {doc.documentName || doc.name || doc.documentCode || "Document"}
                </span>
                {doc.isRequired === false ? (
                  <span className="text-[10px] text-slate-500">(optional)</span>
                ) : (
                  <span className="text-[10px] text-amber-700/80 dark:text-amber-300/80">
                    (required)
                  </span>
                )}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No documents configured for this program.
          </p>
        )}
      </div>
    </div>
  );
}

export default function LenderDetailsModal({
  lender,
  apiBase,
  onClose,
}: LenderDetailsModalProps) {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<LenderSummary | null>(lender);
  const [assignedProducts, setAssignedProducts] = useState<AssignedProductDetail[]>([]);

  useEffect(() => {
    if (!lender) {
      setDetail(null);
      setAssignedProducts([]);
      return;
    }

    const currentLender = lender;
    setDetail(currentLender);

    let cancelled = false;

    async function loadDetails() {
      setLoading(true);
      try {
        const [lenderRes, productsRes] = await Promise.all([
          fetch(
            `${apiBase}/admin/lenders/read?search=${encodeURIComponent(currentLender.id)}`,
            { headers: getAuthHeaders() },
          ),
          fetch(`${apiBase}/admin/lender-products/lender/${currentLender.id}`, {
            headers: getAuthHeaders(),
          }),
        ]);

        if (!cancelled && lenderRes.ok) {
          const lenderJson = await lenderRes.json();
          const row = lenderJson?.data?.results?.[0];
          if (row) {
            setDetail({
              id: row.id,
              name: row.organizationName || currentLender.name,
              email: row.organizationEmail || currentLender.email,
              phone: row.organizationPhone || currentLender.phone,
              status: row.organizationStatus || currentLender.status,
              createdAt: row.createdAt || currentLender.createdAt,
              brokerName: row.brokerName || currentLender.brokerName,
              brokerOrgId: row.brokerOrgId || currentLender.brokerOrgId,
              adminFirstName: row.adminFirstName || currentLender.adminFirstName,
              adminLastName: row.adminLastName || currentLender.adminLastName,
              adminEmail: row.adminEmail || currentLender.adminEmail,
              adminStatus: row.adminStatus || undefined,
              profileImage: currentLender.profileImage,
            });
          }
        }

        if (!cancelled && productsRes.ok) {
          const productsJson = await productsRes.json();
          const list = Array.isArray(productsJson?.data)
            ? productsJson.data
            : [];
          setAssignedProducts(
            list.map((p: Record<string, unknown>) => mapProductRow(p)),
          );
        }
      } catch (err) {
        console.error("Failed to load lender details", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDetails();

    return () => {
      cancelled = true;
    };
  }, [lender, apiBase]);

  if (!lender || !detail) return null;

  const adminName = [detail.adminFirstName, detail.adminLastName]
    .filter(Boolean)
    .join(" ");

  const totalDocuments = assignedProducts.reduce(
    (sum, product) => sum + (product.documents?.length || 0),
    0,
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[500000] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm dark:bg-black/70"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1 bg-gradient-to-r from-[#13538A] via-[#18B6B4] to-emerald-400" />

        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 dark:border-slate-700">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-emerald-100 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10">
              {detail.profileImage ? (
                <img
                  src={`${apiBase}/public${detail.profileImage}`}
                  alt={detail.name}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <Building2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-xl font-bold text-slate-900 dark:text-white">
                  {detail.name}
                </h2>
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusClass(detail.status)}`}
                >
                  {detail.status || "UNKNOWN"}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Complete lender profile and assigned loan products
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="mb-6 flex items-center justify-center gap-2 py-8 text-sm text-blue-600 dark:text-blue-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading complete lender details...
            </div>
          ) : null}

          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Assigned Products
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Package className="h-4 w-4 text-[#13538A] dark:text-blue-400" />
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {assignedProducts.length}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Configured Documents
              </p>
              <div className="mt-2 flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {totalDocuments}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Created On
              </p>
              <div className="mt-2 flex items-center gap-2 text-slate-900 dark:text-white">
                <Calendar className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-semibold">
                  {detail.createdAt
                    ? new Date(detail.createdAt).toLocaleDateString()
                    : "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <Section title="Organization">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DetailRow icon={<Building2 size={16} />} label="Organization Name" value={detail.name} />
                <DetailRow icon={<Mail size={16} />} label="Organization Email" value={detail.email} />
                <DetailRow icon={<Phone size={16} />} label="Organization Phone" value={detail.phone} />
                <DetailRow
                  icon={<Calendar size={16} />}
                  label="Organization Status"
                  value={detail.status}
                />
              </div>
            </Section>

            <Section title="Admin User">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DetailRow icon={<User size={16} />} label="Admin Name" value={adminName || "—"} />
                <DetailRow icon={<Mail size={16} />} label="Admin Email" value={detail.adminEmail} />
                <DetailRow
                  icon={<User size={16} />}
                  label="Admin Status"
                  value={detail.adminStatus || "—"}
                />
              </div>
            </Section>

            <Section title={`Assigned Loan Products (${assignedProducts.length})`}>
              {assignedProducts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  No loan products assigned to this lender yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {assignedProducts.map((product) => (
                    <AssignedProductCard key={product.id} product={product} />
                  ))}
                </div>
              )}
            </Section>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
