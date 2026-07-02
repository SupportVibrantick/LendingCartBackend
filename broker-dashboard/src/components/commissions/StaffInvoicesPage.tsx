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
          ? "border-[#13538A] bg-[#13538A]/5 shadow-sm"
          : "border-slate-200 bg-white hover:border-slate-300 dark:border-gray-800 dark:bg-gray-900"
      }`}
    >
      <p className="text-sm text-slate-500">{title}</p>
      <p
        className={`mt-2 text-2xl font-semibold ${
          tone === "danger" ? "text-rose-600" : "text-slate-900 dark:text-white"
        }`}
      >
        {formatCommissionCurrency(amount)}
      </p>
      <p className="mt-1 text-xs text-slate-500">
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

      <div className="space-y-6">
        <div className="overflow-hidden rounded-2xl border border-[#13538A]/15 bg-gradient-to-br from-[#13538A] via-[#1a6aad] to-[#2C92D5] p-6 text-white shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/70">
            Commissions
          </p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Invoices</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/80">{pageDescription}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-4 md:px-6 dark:border-gray-800">
            <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-950">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-transparent text-sm text-slate-700 outline-none dark:text-gray-200"
              />
              <span className="text-slate-400">→</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-transparent text-sm text-slate-700 outline-none dark:text-gray-200"
              />
            </div>

            <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 dark:border-gray-700">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search invoice or deal..."
                className="w-full bg-transparent text-sm text-slate-700 outline-none dark:text-gray-200"
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
                loadInvoices();
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-300"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="px-6 py-12 text-sm text-slate-500">Loading invoices...</div>
          ) : rows.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-slate-500">No invoices found.</p>
              <p className="mt-2 text-xs text-slate-400">
                Generate invoices from your commission earnings on the dashboard.
              </p>
              <button
                type="button"
                onClick={() => navigate(dashboardPath)}
                className="mt-4 text-sm font-medium text-[#13538A] hover:underline"
              >
                Go to dashboard
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500 dark:bg-gray-800">
                  <tr>
                    <th className="px-5 py-3 font-medium">Deal</th>
                    <th className="px-5 py-3 font-medium">Invoice Number</th>
                    <th className="px-5 py-3 font-medium">Client</th>
                    <th className="px-5 py-3 font-medium">Issue Date</th>
                    <th className="px-5 py-3 font-medium">Amount</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-t border-slate-100 dark:border-gray-800"
                    >
                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {row.applicationNumber || "—"}
                        </div>
                        <div className="text-xs text-slate-500">
                          {row.dealName || row.clientName || "Commission invoice"}
                        </div>
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-800 dark:text-gray-200">
                        {row.invoiceNumber}
                      </td>
                      <td className="px-5 py-4 text-slate-600 dark:text-gray-300">
                        {row.clientName || "—"}
                      </td>
                      <td className="px-5 py-4 text-slate-600 dark:text-gray-300">
                        {formatIssueDate(row.issueDate)}
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-900 dark:text-white">
                        {formatCommissionCurrency(row.amount)}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${invoiceStatusBadgeClass(
                            row.paymentStatus,
                          )}`}
                        >
                          {formatInvoicePaymentStatus(row.paymentStatus)}
                        </span>
                      </td>
                      <td className="relative px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenMenuId((current) =>
                              current === row.id ? null : row.id,
                            )
                          }
                          className="inline-flex rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-gray-800"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>

                        {openMenuId === row.id ? (
                          <div className="absolute right-5 top-12 z-20 w-44 rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                            <button
                              type="button"
                              onClick={() => handleDownload(row)}
                              disabled={downloadingId === row.id}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                              <Download className="h-4 w-4" />
                              {downloadingId === row.id ? "Downloading..." : "Download PDF"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleViewDeal(row)}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-gray-200 dark:hover:bg-gray-800"
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

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-4 md:px-6 dark:border-gray-800">
            <p className="text-sm text-slate-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
              </select>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200"
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
