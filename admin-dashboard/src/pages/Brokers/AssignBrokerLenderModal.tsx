import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Mail,
  Search,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  assignBrokerLender,
  fetchBrokerLenders,
  fetchPlatformLenders,
  type PlatformLenderRow,
} from "../../lib/brokerDetailApi";

type Props = {
  brokerId: string;
  onClose: () => void;
  onAssigned: () => void;
};

const PAGE_SIZE = 12;

function statusBadgeClass(status?: string | null) {
  const normalized = (status || "").toUpperCase();
  if (normalized === "ACTIVE") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900";
  }
  return "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
}

export default function AssignBrokerLenderModal({
  brokerId,
  onClose,
  onAssigned,
}: Props) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [lenders, setLenders] = useState<PlatformLenderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [assignedLenderIds, setAssignedLenderIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const assignedSet = useMemo(() => new Set(assignedLenderIds), [assignedLenderIds]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const json = await fetchBrokerLenders(brokerId, 1, "", 200);
        if (!cancelled) {
          const ids = (json.data || [])
            .map((row) => row.lenderOrgId || row.lender?.id)
            .filter((id): id is string => Boolean(id));
          setAssignedLenderIds(ids);
        }
      } catch {
        if (!cancelled) {
          setAssignedLenderIds([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [brokerId]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
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
        const json = await fetchPlatformLenders(debouncedSearch, page, PAGE_SIZE);
        if (!cancelled) {
          setLenders(json.data || []);
          setTotal(json.meta?.total ?? 0);
          setTotalPages(json.meta?.totalPages ?? 1);
        }
      } catch (err: any) {
        if (!cancelled) {
          toast.error(err.message || "Failed to load lenders");
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
  }, [debouncedSearch, page]);

  const availableLenders = lenders.filter((row) => !assignedSet.has(row.id));

  const handleAssign = async (lenderId: string) => {
    try {
      setAssigningId(lenderId);
      await assignBrokerLender(brokerId, lenderId);
      toast.success("Lender assigned successfully");
      setAssignedLenderIds((prev) => [...prev, lenderId]);
      onAssigned();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to assign lender");
    } finally {
      setAssigningId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px]">
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="h-1 bg-gradient-to-r from-[#13538A] via-cyan-600 to-teal-500 opacity-80" />

        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Assign Lender</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Select a lender from the platform database to connect with this broker.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
          <div className="relative w-full sm:max-w-md">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search lender name or email..."
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-[#13538A] dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
          <p className="shrink-0 text-[10px] text-slate-400">
            {total} lender{total === 1 ? "" : "s"}
            {debouncedSearch ? ` matching "${debouncedSearch}"` : ""}
            {assignedSet.size > 0 ? ` · ${assignedSet.size} already assigned` : ""}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-xs text-slate-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin text-[#13538A]" />
              Loading lenders...
            </div>
          ) : !availableLenders.length ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-6 py-16 text-center text-xs text-slate-500 dark:border-slate-700">
              {debouncedSearch
                ? `No available lenders found for "${debouncedSearch}".`
                : assignedSet.size > 0 && lenders.length > 0
                  ? "All lenders on this page are already assigned. Try the next page."
                  : "No lenders found in the platform database."}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {availableLenders.map((row) => {
                const isAssigning = assigningId === row.id;

                return (
                  <div
                    key={row.id}
                    className="flex flex-col rounded-xl border border-slate-200 bg-slate-50/50 p-3 transition hover:border-[#13538A]/30 hover:shadow-sm dark:border-slate-700 dark:bg-slate-800/40"
                  >
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#13538A]/10 text-[#13538A]">
                        <Building2 size={18} />
                      </div>
                      {row.status ? (
                        <span
                          className={`rounded-md border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${statusBadgeClass(row.status)}`}
                        >
                          {row.status}
                        </span>
                      ) : null}
                    </div>

                    <p
                      className="line-clamp-2 text-xs font-semibold text-slate-800 dark:text-slate-100"
                      title={row.name}
                    >
                      {row.name}
                    </p>

                    <p
                      className="mt-1 flex min-w-0 items-center gap-1 text-[10px] text-slate-500"
                      title={row.email || undefined}
                    >
                      <Mail size={10} className="shrink-0 opacity-70" />
                      <span className="truncate">{row.email || "—"}</span>
                    </p>

                    <button
                      type="button"
                      disabled={isAssigning}
                      onClick={() => handleAssign(row.id)}
                      className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#13538A] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#0f426d] disabled:opacity-60"
                    >
                      {isAssigning ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Assigning...
                        </>
                      ) : (
                        "Assign"
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex flex-col gap-2 border-t border-slate-100 px-5 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
            <p className="text-[10px] text-slate-500">
              Page {page} of {totalPages}
              {availableLenders.length > 0
                ? ` · showing ${availableLenders.length} available on this page`
                : ""}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <ChevronLeft size={14} />
                Prev
              </button>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
