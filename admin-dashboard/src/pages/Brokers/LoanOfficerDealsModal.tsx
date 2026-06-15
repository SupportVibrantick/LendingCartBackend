import { useEffect, useState } from "react";
import { Briefcase, ChevronLeft, ChevronRight, ExternalLink, FileText, Loader2, Search, User, X } from "lucide-react";
import toast from "react-hot-toast";
import {
  fetchBrokerLoanOfficerApplications,
  type BrokerApplicationRow,
  type BrokerTeamMember,
} from "../../lib/brokerDetailApi";
import ApplicationDetailModal from "../../components/applications/ApplicationDetailModal";

type Props = {
  brokerId: string;
  officer: BrokerTeamMember;
  onClose: () => void;
  formatDate: (value?: string | null) => string;
  statusBadge: (status?: string) => string;
};

const PAGE_SIZE = 5;

function formatProductCode(code?: string | null) {
  if (!code) return "—";
  return code
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getInitials(first?: string | null, last?: string | null, email?: string) {
  const fromName = `${first?.charAt(0) || ""}${last?.charAt(0) || ""}`.trim();
  if (fromName) return fromName.toUpperCase();
  return email?.charAt(0)?.toUpperCase() || "?";
}

export default function LoanOfficerDealsModal({
  brokerId,
  officer,
  onClose,
  formatDate,
  statusBadge,
}: Props) {
  const [applications, setApplications] = useState<BrokerApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(officer.assignedDeals ?? officer.assignedApplications ?? 0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAmount, setTotalAmount] = useState(0);
  const [viewApplicationId, setViewApplicationId] = useState<string | null>(null);

  const officerName =
    [officer.firstName, officer.lastName].filter(Boolean).join(" ") || officer.email || "Loan Officer";

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const json = await fetchBrokerLoanOfficerApplications(brokerId, officer.id, {
          page,
          limit: PAGE_SIZE,
          search: debouncedSearch,
        });
        if (!cancelled) {
          setApplications(json.data || []);
          setTotal(json.meta?.total ?? json.data?.length ?? 0);
          setTotalPages(json.meta?.totalPages ?? 1);
          setTotalAmount(json.summary?.totalAmount ?? 0);
        }
      } catch (err: any) {
        if (!cancelled) {
          toast.error(err.message || "Failed to load applications");
          onClose();
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [brokerId, officer.id, onClose, page, debouncedSearch]);

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px]">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="h-1 bg-gradient-to-r from-[#13538A] via-[#18B6B4] to-emerald-400 opacity-80" />

        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#13538A]/10 text-[#13538A]">
              <Briefcase size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Assigned Deals</h3>
              <p className="mt-0.5 truncate text-[11px] text-slate-500">{officerName}</p>
              {officer.email ? (
                <p className="truncate text-[10px] text-slate-400">{officer.email}</p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X size={16} />
          </button>
        </div>

        <div className="border-b border-slate-100 px-5 py-3 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800/60">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#13538A]/10 text-[10px] font-bold text-[#13538A]">
                {getInitials(officer.firstName, officer.lastName, officer.email)}
              </div>
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Officer</p>
                <p className="text-[11px] font-medium text-slate-800 dark:text-slate-100">{officerName}</p>
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800/60">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Applications</p>
              <p className="text-sm font-bold text-[#13538A]">{total}</p>
            </div>
            {totalAmount > 0 ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 dark:border-emerald-900/40 dark:bg-emerald-950/30">
                <p className="text-[9px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                  Total requested amount
                </p>
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                  ${totalAmount.toLocaleString()}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="border-b border-slate-100 px-5 py-3 dark:border-slate-800">
          <div className="relative max-w-md">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search application #, borrower, product, status..."
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-700 outline-none transition focus:border-[#13538A]/40 focus:ring-2 focus:ring-[#13538A]/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 py-4">
          {loading ? (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200 py-16 text-xs text-slate-500 dark:border-slate-700">
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-[#13538A]" />
              Loading applications...
            </div>
          ) : !applications.length ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-800/30">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
                <FileText size={22} />
              </div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {debouncedSearch ? "No matching applications" : "No deals yet"}
              </p>
              <p className="mt-1 max-w-xs text-[11px] text-slate-500">
                {debouncedSearch
                  ? `No results for "${debouncedSearch}". Try a different search.`
                  : "This loan officer does not have any assigned applications for this broker."}
              </p>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="min-h-0 flex-1 overflow-auto">
                <table className="min-w-full text-xs">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/95">
                    <tr>
                      {["Application", "Borrower", "Product", "Amount", "Status", "Created"].map((header) => (
                        <th key={header} className="px-3 py-2.5 whitespace-nowrap">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                    {applications.map((row) => (
                      <tr
                        key={row.applicationId}
                        className="cursor-pointer transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                        onClick={() => setViewApplicationId(row.applicationId)}
                      >
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewApplicationId(row.applicationId);
                            }}
                            className="group text-left"
                            title="View application details"
                          >
                            <p className="inline-flex items-center gap-1 font-semibold text-[#13538A] group-hover:underline">
                              {row.applicationNumber || row.applicationId}
                              <ExternalLink size={11} className="opacity-70" />
                            </p>
                            {row.purpose ? (
                              <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-400">{row.purpose}</p>
                            ) : null}
                          </button>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 dark:bg-slate-800">
                              <User size={12} />
                            </div>
                            <span className="font-medium text-slate-800 dark:text-slate-100">
                              {row.borrowerName || "—"}
                            </span>
                          </div>
                        </td>
                        <td className="max-w-[180px] px-3 py-3 text-slate-600 dark:text-slate-300">
                          <span className="line-clamp-2" title={row.loanProductCode || undefined}>
                            {formatProductCode(row.loanProductCode)}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-semibold text-slate-900 dark:text-slate-100">
                          {row.amountRequested != null
                            ? `$${Number(row.amountRequested).toLocaleString()}`
                            : "—"}
                        </td>
                        <td className="px-3 py-3">
                          <span className={statusBadge(row.status)}>
                            {row.status?.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-slate-500 dark:text-slate-400">
                          {formatDate(row.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
          <p className="text-[11px] text-slate-500">
            {total > 0 ? (
              <>
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
              </>
            ) : (
              "No applications"
            )}
          </p>

          <div className="flex items-center gap-2">
            {totalPages > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(current - 1, 1))}
                  disabled={page <= 1 || loading}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <ChevronLeft size={14} />
                  Prev
                </button>
                <span className="text-[11px] font-medium text-slate-500">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
                  disabled={page >= totalPages || loading}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Next
                  <ChevronRight size={14} />
                </button>
              </>
            ) : null}

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-slate-100 px-4 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {viewApplicationId && (
        <ApplicationDetailModal
          applicationId={viewApplicationId}
          onClose={() => setViewApplicationId(null)}
        />
      )}
    </div>
  );
}
