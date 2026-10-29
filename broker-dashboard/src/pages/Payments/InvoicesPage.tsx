import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  MoreVertical,
  RefreshCw,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import toast from "react-hot-toast";
import PageMeta from "../../components/common/PageMeta";
import { brokerFetch } from "../../lib/brokerApi";
import {
  formatCommissionCurrency,
  formatInvoicePaymentStatus,
  getInvoicePdfUrl,
  invoiceStatusBadgeClass,
  type InvoiceListRecord,
  type InvoiceListResponse,
  type InvoiceSummary,
} from "../../lib/commissionApi";

type StatusFilter =
  | "ALL"
  | "DRAFT"
  | "DUE"
  | "RECEIVED"
  | "OVERDUE";

const ACTION_MENU_WIDTH = 176;
const ACTION_MENU_HEIGHT = 120;

const AVATAR_TONES = [
  "bg-orange-100 text-orange-700",
  "bg-amber-100 text-amber-700",
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
];

function computeActionMenuPosition(rect: DOMRect) {
  const padding = 8;
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  const openUpward =
    spaceBelow < ACTION_MENU_HEIGHT + padding && spaceAbove > spaceBelow;

  let top = openUpward ? rect.top - ACTION_MENU_HEIGHT - 6 : rect.bottom + 6;
  top = Math.max(
    padding,
    Math.min(top, window.innerHeight - ACTION_MENU_HEIGHT - padding),
  );

  const left = Math.max(
    padding,
    Math.min(
      rect.right - ACTION_MENU_WIDTH,
      window.innerWidth - ACTION_MENU_WIDTH - padding,
    ),
  );

  return { top, left };
}

function getInitials(name?: string | null) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
}

function getAvatarTone(seed: string) {
  const index = seed.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_TONES[index % AVATAR_TONES.length];
}

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
      className={`rounded-2xl border p-4 text-left transition-all ${active
        ? "border-[#13538A] bg-[#13538A]/5 shadow-sm"
        : "border-slate-200 bg-white hover:border-slate-300"
        }`}
    >
      <p className="text-sm text-slate-500">{title}</p>
      <p
        className={`mt-2 text-2xl font-semibold ${tone === "danger" ? "text-rose-600" : "text-slate-900"
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

export default function InvoicesPage() {
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
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const isBrokerAdmin = useMemo(() => {
    try {
      const roles = JSON.parse(sessionStorage.getItem("roles") || "[]");
      return roles.includes("BROKER_ADMIN");
    } catch {
      return false;
    }
  }, []);

  const loadInvoices = useCallback(async () => {
    if (!isBrokerAdmin) return;

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

      const json = await brokerFetch<InvoiceListResponse>(
        `/broker/commissions/invoices?${params}`,
      );

      setRows(json.data || []);
      setSummary(json.summary || null);
      setTotalPages(json.pagination?.totalPages || 1);
    } catch (error: any) {
      toast.error(error.message || "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, [endDate, isBrokerAdmin, limit, page, search, startDate, statusFilter]);

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        menuRef.current?.contains(target) ||
        (target instanceof Element && target.closest("[data-menu-id]"))
      ) {
        return;
      }
      setOpenMenuId(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenuId(null);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!openMenuId) return;

    const reposition = () => {
      const btn = document.querySelector(
        `[data-menu-id="${openMenuId}"]`,
      ) as HTMLElement | null;
      if (!btn) return;
      setMenuPos(computeActionMenuPosition(btn.getBoundingClientRect()));
    };

    reposition();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);

    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [openMenuId]);

  const activeMenuRow = useMemo(
    () => rows.find((row) => row.id === openMenuId) ?? null,
    [rows, openMenuId],
  );

  const openRowMenu = (
    id: string,
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation();
    setMenuPos(
      computeActionMenuPosition(event.currentTarget.getBoundingClientRect()),
    );
    setOpenMenuId((current) => (current === id ? null : id));
  };

  const closeRowMenu = () => setOpenMenuId(null);

  const handleDownload = async (row: InvoiceListRecord) => {
    try {
      setDownloadingId(row.id);
      const token = sessionStorage.getItem("broker_token");
      const res = await fetch(getInvoicePdfUrl(row.id), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
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
      closeRowMenu();
    }
  };

  const handleViewDeal = (row: InvoiceListRecord) => {
    closeRowMenu();
    if (row.submissionId) {
      navigate("/loan-preview", {
        state: {
          submissionId: row.submissionId,
          activeTab: "commissions",
        },
      });
      return;
    }
    navigate("/payments/commissions");
  };

  const handleStatusCardClick = (status: StatusFilter) => {
    setStatusFilter((current) => (current === status ? "ALL" : status));
    setPage(1);
  };

  if (!isBrokerAdmin) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Invoices</h2>
        <p className="mt-2 text-sm text-slate-500">
          Only broker admins can view payment invoices.
        </p>
      </div>
    );
  }

  return (
    <>
      <PageMeta
        title="Invoices | Payments | Broker Dashboard"
        description="Create and manage commission invoices"
      />

      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Invoices</h2>
            <p className="mt-1 text-sm text-slate-500">
              Create and manage all invoices generated for your business
            </p>
          </div>
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

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-4 md:px-6">
            <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-transparent text-sm text-slate-700 outline-none"
              />
              <span className="text-slate-400">→</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-transparent text-sm text-slate-700 outline-none"
              />
            </div>

            <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search invoice, customer, deal..."
                className="w-full text-sm text-slate-700 outline-none"
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
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
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
                Generate invoices from funded deal commissions.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-6 py-3 font-medium">Invoice Name</th>
                    <th className="px-6 py-3 font-medium">Invoice Number</th>
                    <th className="px-6 py-3 font-medium">Customer</th>
                    <th className="px-6 py-3 font-medium">Issue Date</th>
                    <th className="px-6 py-3 font-medium">Amount</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="px-6 py-4">
                        <div className="max-w-[220px] truncate font-medium text-slate-900">
                          {row.dealName || row.applicationNumber || "Commission Invoice"}
                        </div>
                        {/* <div className="text-xs text-slate-500">
                          {row.applicationNumber || "—"}
                        </div> */}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-800">
                        {row.invoiceNumber}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${getAvatarTone(
                              row.recipientEmail || row.recipientName || row.id,
                            )}`}
                          >
                            {getInitials(row.recipientName)}
                          </div>
                          <div>
                            <div className="font-medium text-slate-900">
                              {row.recipientName || "—"}
                            </div>
                            <div className="text-xs text-slate-500">
                              {row.recipientEmail || "—"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {formatIssueDate(row.issueDate)}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        {formatCommissionCurrency(row.amount)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${invoiceStatusBadgeClass(
                            row.paymentStatus,
                          )}`}
                        >
                          {formatInvoicePaymentStatus(row.paymentStatus)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          data-menu-id={row.id}
                          onClick={(event) => openRowMenu(row.id, event)}
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                            openMenuId === row.id
                              ? "border-[#13538A]/30 bg-[#13538A]/5 text-[#13538A]"
                              : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
                          }`}
                          title="More actions"
                          aria-label="Open actions menu"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-4 md:px-6">
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
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700"
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
              </select>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-50"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {activeMenuRow &&
        openMenuId &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", top: menuPos.top, left: menuPos.left }}
            className="z-[9999] w-[176px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
          >
            <div className="border-b border-slate-100 px-3 py-2">
              <p className="truncate text-[11px] font-semibold text-slate-900">
                {activeMenuRow.invoiceNumber}
              </p>
              <p className="truncate text-[10px] text-slate-500">
                {activeMenuRow.recipientName ||
                  activeMenuRow.dealName ||
                  "Invoice"}
              </p>
            </div>

            <div className="py-0.5">
              <button
                type="button"
                onClick={() => void handleDownload(activeMenuRow)}
                disabled={downloadingId === activeMenuRow.id}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                <Download className="h-3.5 w-3.5 text-[#13538A]" />
                {downloadingId === activeMenuRow.id
                  ? "Downloading..."
                  : "Download PDF"}
              </button>
              <button
                type="button"
                onClick={() => handleViewDeal(activeMenuRow)}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-700 transition hover:bg-slate-50"
              >
                <ExternalLink className="h-3.5 w-3.5 text-cyan-600" />
                View Deal
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
