import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  MoreVertical,
  RefreshCw,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import toast from "react-hot-toast";
import PageMeta from "../common/PageMeta";
import {
  formatCommissionCurrency,
  formatInvoicePaymentStatus,
  getInvoicePdfUrl,
  invoiceStatusBadgeClass,
  type InvoiceListRecord,
  type InvoiceListResponse,
  type InvoiceSummary,
} from "../../lib/commissionApi";

type Portal = "loanofficer" | "subbroker";

type StatusFilter = "ALL" | "DRAFT" | "DUE" | "RECEIVED" | "OVERDUE";

type Props = {
  portal: Portal;
  apiBase: string;
  invoicesPath: string;
  getHeaders: () => HeadersInit;
  pageTitle: string;
  pageDescription: string;
  previewPath: string;
  dashboardPath: string;
};

function formatIssueDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function SummaryCard({
  title,
  count,
  amount,
  active,
  onClick,
  tone = "default",
}: {
  title: string;
  count: number;
  amount: number;
  active?: boolean;
  onClick?: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition-all ${
        active
          ? "border-[#4C78F5] bg-[#4C78F5]/5 shadow-sm"
          : "border-border bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900"
      }`}
    >
      <p className="text-sm text-text-secondary">{title}</p>
      <p
        className={`mt-2 text-2xl font-semibold ${
          tone === "danger" ? "text-rose-600" : "text-text-primary dark:text-white"
        }`}
      >
        {formatCommissionCurrency(amount)}
      </p>
      <p className="mt-1 text-xs text-text-secondary">
        {count} invoice{count === 1 ? "" : "s"}
      </p>
    </button>
  );
}

export default function StaffInvoicesPage({
  portal,
  apiBase,
  invoicesPath,
  getHeaders,
  pageTitle,
  pageDescription,
  previewPath,
  dashboardPath,
}: Props) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<InvoiceListRecord[]>([]);
  const [summary, setSummary] = useState<InvoiceSummary | null>(null);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const loadInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });

      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (search) params.set("search", search);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const res = await fetch(`${apiBase}${invoicesPath}?${params}`, {
        headers: getHeaders(),
      });
      const json = (await res.json()) as InvoiceListResponse & {
        message?: string;
      };

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load invoices");
      }

      setRows(json.data || []);
      setSummary(json.summary || null);
      setTotalPages(json.pagination?.totalPages || 1);
    } catch (error: any) {
      toast.error(error.message || "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, [
    apiBase,
    endDate,
    getHeaders,
    invoicesPath,
    limit,
    page,
    search,
    startDate,
    statusFilter,
  ]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const handleDownload = async (row: InvoiceListRecord) => {
    try {
      setDownloadingId(row.id);
      const res = await fetch(getInvoicePdfUrl(row.id, portal), {
        headers: getHeaders(),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message || "Failed to download invoice");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${row.invoiceNumber || "invoice"}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error(error.message || "Failed to download invoice");
    } finally {
      setDownloadingId(null);
      setOpenMenuId(null);
    }
  };

  const handleViewDeal = (row: InvoiceListRecord) => {
    setOpenMenuId(null);
    if (row.submissionId) {
      navigate(previewPath, {
        state: { submissionId: row.submissionId },
      });
      return;
    }
    navigate(dashboardPath);
  };

  const handleStatusCardClick = (status: StatusFilter) => {
    setStatusFilter((current) => (current === status ? "ALL" : status));
    setPage(1);
  };

  return (
    <>
      <PageMeta title={pageTitle} description={pageDescription} />

      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[16px] font-semibold tracking-tight text-text-primary dark:text-white">
              Invoices
            </h2>
            <p className="mt-0.5 text-[13px] text-text-secondary">
              {pageDescription}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Invoice(s) in Draft"
            count={summary?.draft.count || 0}
            amount={summary?.draft.amount || 0}
            active={statusFilter === "DRAFT"}
            onClick={() => handleStatusCardClick("DRAFT")}
          />
          <SummaryCard
            title="Invoice(s) in Due"
            count={summary?.due.count || 0}
            amount={summary?.due.amount || 0}
            active={statusFilter === "DUE"}
            onClick={() => handleStatusCardClick("DUE")}
          />
          <SummaryCard
            title="Invoice(s) received"
            count={summary?.received.count || 0}
            amount={summary?.received.amount || 0}
            active={statusFilter === "RECEIVED"}
            onClick={() => handleStatusCardClick("RECEIVED")}
          />
          <SummaryCard
            title="Invoice(s) Overdue"
            count={summary?.overdue.count || 0}
            amount={summary?.overdue.amount || 0}
            active={statusFilter === "OVERDUE"}
            onClick={() => handleStatusCardClick("OVERDUE")}
            tone="danger"
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-white dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3.5 md:px-5 dark:border-slate-800">
            <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-transparent text-sm text-text-primary outline-none dark:text-gray-200"
              />
              <span className="text-text-secondary">→</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-transparent text-sm text-text-primary outline-none dark:text-gray-200"
              />
            </div>

            <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-border px-3 py-2 dark:border-slate-700">
              <Search className="h-4 w-4 text-text-secondary" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search invoice or deal..."
                className="w-full bg-transparent text-sm text-text-primary outline-none dark:text-gray-200"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setSearch("");
                setStartDate("");
                setEndDate("");
                setStatusFilter("ALL");
                setPage(1);
                void loadInvoices();
              }}
              className="ds-btn-secondary h-10 px-3 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="px-5 py-12 text-center text-sm text-text-secondary">
              Loading invoices…
            </div>
          ) : rows.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <p className="text-sm font-semibold text-text-primary">
                No invoices found
              </p>
              <p className="mt-1.5 text-xs text-text-secondary">
                Generate invoices from your commission earnings.
              </p>
              <button
                type="button"
                onClick={() => navigate(dashboardPath)}
                className="mt-4 text-sm font-semibold text-[#4C78F5] hover:underline"
              >
                Go to dashboard
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ds-table min-w-[880px] w-full">
                <thead>
                  <tr>
                    {[
                      "Deal",
                      "Invoice Number",
                      "Client",
                      "Issue Date",
                      "Amount",
                      "Status",
                      "Actions",
                    ].map((label) => (
                      <th
                        key={label}
                        className={label === "Actions" ? "!text-right" : undefined}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <p className="ds-table-title">
                          {row.applicationNumber || "—"}
                        </p>
                        <p className="ds-table-meta">
                          {row.dealName || row.clientName || "Commission invoice"}
                        </p>
                      </td>
                      <td className="font-medium text-text-primary dark:text-gray-200">
                        {row.invoiceNumber}
                      </td>
                      <td className="ds-table-muted">{row.clientName || "—"}</td>
                      <td className="ds-table-muted whitespace-nowrap">
                        {formatIssueDate(row.issueDate)}
                      </td>
                      <td>
                        <span className="ds-table-amount">
                          {formatCommissionCurrency(row.amount)}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${invoiceStatusBadgeClass(
                            row.paymentStatus,
                          )}`}
                        >
                          {formatInvoicePaymentStatus(row.paymentStatus)}
                        </span>
                      </td>
                      <td className="relative !text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenMenuId((current) =>
                              current === row.id ? null : row.id,
                            )
                          }
                          className="inline-flex rounded-lg p-2 text-text-secondary hover:bg-surface dark:hover:bg-slate-800"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>

                        {openMenuId === row.id ? (
                          <div className="absolute right-3 top-12 z-20 w-44 rounded-xl border border-border bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                            <button
                              type="button"
                              onClick={() => void handleDownload(row)}
                              disabled={downloadingId === row.id}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-surface disabled:opacity-60 dark:text-gray-200 dark:hover:bg-slate-800"
                            >
                              <Download className="h-4 w-4" />
                              {downloadingId === row.id
                                ? "Downloading..."
                                : "Download PDF"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleViewDeal(row)}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-surface dark:text-gray-200 dark:hover:bg-slate-800"
                            >
                              <ExternalLink className="h-4 w-4" />
                              View Deal
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3.5 md:px-5 dark:border-slate-800">
            <p className="text-sm text-text-secondary">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="rounded-lg border border-border px-2 py-1.5 text-sm text-text-primary dark:border-slate-700 dark:bg-slate-950 dark:text-gray-200"
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
              </select>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm text-text-primary disabled:opacity-50 dark:border-slate-700 dark:text-gray-200"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm text-text-primary disabled:opacity-50 dark:border-slate-700 dark:text-gray-200"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
