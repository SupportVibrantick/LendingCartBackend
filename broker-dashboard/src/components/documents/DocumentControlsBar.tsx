import {
  Building2,
  ChevronDown,
  Filter,
  Search,
  SendHorizonal,
  X,
  Zap,
} from "lucide-react";
import type { DocumentSentFilter } from "../../lib/documentLenderSend";

type DocumentFilterLender = {
  applicationLenderId: string;
  lenderName: string;
  requestedDocumentCount: number;
};

type DocumentControlsBarProps = {
  autoForwardEnabled: boolean;
  autoForwardSaving: boolean;
  onToggleAutoForward: () => void;
  documentFilterLenders: DocumentFilterLender[];
  documentLenderFilter: string;
  onDocumentLenderFilterChange: (value: string) => void;
  documentSentFilter: DocumentSentFilter;
  onDocumentSentFilterChange: (value: DocumentSentFilter) => void;
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onResetPage: () => void;
  manualSendSlot?: React.ReactNode;
};

const selectClass =
  "w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-9 pr-9 text-sm text-slate-800 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 dark:border-slate-700 dark:bg-slate-800/80 dark:text-white dark:hover:border-slate-600 dark:focus:border-blue-400 dark:focus:bg-slate-900";

const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";

export default function DocumentControlsBar({
  autoForwardEnabled,
  autoForwardSaving,
  onToggleAutoForward,
  documentFilterLenders,
  documentLenderFilter,
  onDocumentLenderFilterChange,
  documentSentFilter,
  onDocumentSentFilterChange,
  searchInput,
  onSearchInputChange,
  onResetPage,
  manualSendSlot,
}: DocumentControlsBarProps) {
  const hasActiveFilters =
    Boolean(documentLenderFilter) ||
    documentSentFilter !== "all" ||
    Boolean(searchInput.trim());

  const clearFilters = () => {
    onDocumentLenderFilterChange("");
    onDocumentSentFilterChange("all");
    onSearchInputChange("");
    onResetPage();
  };

  return (
    <div className="mb-5 space-y-3">
      {/* Auto-forward */}
      <div
        className={`flex flex-col gap-3 rounded-2xl border px-4 py-3.5 shadow-sm transition sm:flex-row sm:items-center sm:justify-between ${
          autoForwardEnabled
            ? "border-emerald-200/80 bg-gradient-to-r from-emerald-50/90 to-teal-50/50 dark:border-emerald-900/40 dark:from-emerald-950/30 dark:to-slate-900"
            : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
        }`}
      >
        <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              autoForwardEnabled
                ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30"
                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
            }`}
          >
            <Zap size={18} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-slate-800 dark:text-white">
                Auto document forwarding
              </p>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  autoForwardEnabled
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {autoForwardEnabled ? "On" : "Off"}
              </span>
            </div>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {autoForwardEnabled
                ? "New uploads are sent directly to the lender(s) that requested them."
                : "Review uploads first, then choose which lender receives each document."}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3 self-end sm:self-center">
          {manualSendSlot}

          <button
            type="button"
            role="switch"
            aria-checked={autoForwardEnabled}
            aria-label="Toggle auto document forwarding"
            disabled={autoForwardSaving}
            onClick={onToggleAutoForward}
            className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors duration-200 ${
              autoForwardEnabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
            } ${autoForwardSaving ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
                autoForwardEnabled ? "translate-x-7" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Filters & search */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
            <Filter size={15} className="text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-semibold">Filter & search</span>
            {hasActiveFilters && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                Active
              </span>
            )}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X size={14} />
              Clear all
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-12">
          {/* Search — primary, wider */}
          <div className="md:col-span-2 xl:col-span-5">
            <label htmlFor="doc-search" className={labelClass}>
              Search
            </label>
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                id="doc-search"
                type="search"
                placeholder="Search by document name..."
                value={searchInput}
                onChange={(e) => {
                  onSearchInputChange(e.target.value);
                  onResetPage();
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-9 pr-9 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 dark:border-slate-700 dark:bg-slate-800/80 dark:text-white dark:focus:border-blue-400 dark:focus:bg-slate-900"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    onSearchInputChange("");
                    onResetPage();
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:bg-slate-200/80 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Lender filter */}
          {documentFilterLenders.length > 0 && (
            <div className="xl:col-span-4">
              <label htmlFor="doc-lender-filter" className={labelClass}>
                Lender
              </label>
              <div className="relative">
                <Building2
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <select
                  id="doc-lender-filter"
                  value={documentLenderFilter}
                  onChange={(e) => {
                    onDocumentLenderFilterChange(e.target.value);
                    onResetPage();
                  }}
                  className={selectClass}
                >
                  <option value="">All lenders</option>
                  {documentFilterLenders.map((lender) => (
                    <option
                      key={lender.applicationLenderId}
                      value={lender.applicationLenderId}
                    >
                      {lender.lenderName} ({lender.requestedDocumentCount})
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
              </div>
            </div>
          )}

          {/* Sent filter */}
          <div
            className={
              documentFilterLenders.length > 0
                ? "xl:col-span-3"
                : "md:col-span-2 xl:col-span-4"
            }
          >
            <label htmlFor="doc-sent-filter" className={labelClass}>
              Send status
            </label>
            <div className="relative">
              <SendHorizonal
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <select
                id="doc-sent-filter"
                value={documentSentFilter}
                onChange={(e) => {
                  onDocumentSentFilterChange(
                    e.target.value as DocumentSentFilter,
                  );
                  onResetPage();
                }}
                className={selectClass}
              >
                <option value="all">All documents</option>
                <option value="sent">Sent to lender</option>
                <option value="not_sent">Not sent yet</option>
              </select>
              <ChevronDown
                size={16}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
