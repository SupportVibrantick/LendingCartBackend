import {
  Building2,
  ChevronDown,
  Filter,
  Search,
  SendHorizonal,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import type {
  DocumentSentFilter,
  DocumentSourceFilter,
} from "../../lib/documentLenderSend";

type DocumentFilterLender = {
  applicationLenderId: string;
  lenderName: string;
  requestedDocumentCount: number;
};

type DocumentControlsBarProps = {
  autoForwardEnabled: boolean;
  autoForwardSaving: boolean;
  onToggleAutoForward: () => void;
  autoForwardToClientEnabled?: boolean;
  autoForwardToClientSaving?: boolean;
  onToggleAutoForwardToClient?: () => void;
  showAutoForwardToClient?: boolean;
  documentFilterLenders: DocumentFilterLender[];
  documentLenderFilter: string;
  onDocumentLenderFilterChange: (value: string) => void;
  documentSentFilter: DocumentSentFilter;
  onDocumentSentFilterChange: (value: DocumentSentFilter) => void;
  documentSourceFilter: DocumentSourceFilter;
  onDocumentSourceFilterChange: (value: DocumentSourceFilter) => void;
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onResetPage: () => void;
  manualSendSlot?: React.ReactNode;
  showAutoForward?: boolean;
  showSentFilter?: boolean;
  showSourceFilter?: boolean;
  showLenderFilter?: boolean;
  brokerSourceFilterLabel?: string;
  coBrokerSourceFilterLabel?: string;
  /** When true, show locked Elite upgrade cards instead of hiding toggles. */
  autoForwardEliteLocked?: boolean;
};

const selectClass =
  "w-full appearance-none rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm text-slate-800 outline-none transition hover:border-slate-300 focus:border-[#3A99D8] focus:ring-2 focus:ring-[#3A99D8]/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:hover:border-slate-600";

const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";

const searchInputClass =
  "w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[#3A99D8] focus:ring-2 focus:ring-[#3A99D8]/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden";

export default function DocumentControlsBar({
  autoForwardEnabled,
  autoForwardSaving,
  onToggleAutoForward,
  autoForwardToClientEnabled = false,
  autoForwardToClientSaving = false,
  onToggleAutoForwardToClient,
  showAutoForwardToClient = false,
  documentFilterLenders,
  documentLenderFilter,
  onDocumentLenderFilterChange,
  documentSentFilter,
  onDocumentSentFilterChange,
  documentSourceFilter,
  onDocumentSourceFilterChange,
  searchInput,
  onSearchInputChange,
  onResetPage,
  manualSendSlot,
  showAutoForward = true,
  showSentFilter = true,
  showSourceFilter = true,
  showLenderFilter = true,
  brokerSourceFilterLabel = "My documents",
  coBrokerSourceFilterLabel = "Co broker",
  autoForwardEliteLocked = false,
}: DocumentControlsBarProps) {
  const visibleLenderFilters =
    showLenderFilter && documentFilterLenders.length > 0;
  const hasActiveFilters =
    Boolean(documentLenderFilter) ||
    documentSentFilter !== "all" ||
    documentSourceFilter !== "all" ||
    Boolean(searchInput.trim());

  const clearFilters = () => {
    onDocumentLenderFilterChange("");
    onDocumentSentFilterChange("all");
    onDocumentSourceFilterChange("all");
    onSearchInputChange("");
    onResetPage();
  };

  return (
    <div className="mb-5 space-y-3">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {autoForwardEliteLocked && (
          <>
            <div className="flex h-full flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3.5 dark:border-amber-900/40 dark:bg-amber-950/20 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                  <Zap size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800 dark:text-white">
                      Auto Forward to Lender
                    </p>
                    <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                      Elite
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Upgrade to Elite to auto-forward uploads to lenders.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex h-full flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3.5 dark:border-amber-900/40 dark:bg-amber-950/20 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                  <UserRound size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800 dark:text-white">
                      Auto Forward to Client
                    </p>
                    <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                      Elite
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Upgrade to Elite to auto-forward lender requests to clients.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {showAutoForward && (
          <div
            className={`flex h-full flex-col gap-3 rounded-xl border px-4 py-3.5 transition sm:flex-row sm:items-center sm:justify-between ${
              autoForwardEnabled
                ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
            }`}
          >
            <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  autoForwardEnabled
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                <Zap size={16} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-800 dark:text-white">
                    Auto Forward to Lender
                  </p>
                  <span
                    className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      autoForwardEnabled
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {autoForwardEnabled ? "On" : "Off"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {autoForwardEnabled
                    ? "New uploads are sent automatically to the relevant lender(s)."
                    : "Review uploads first, then choose which lender receives each document."}
                </p>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={autoForwardEnabled}
              aria-label="Toggle Auto Forward to Lender"
              disabled={autoForwardSaving}
              onClick={onToggleAutoForward}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 self-end sm:self-center ${
                autoForwardEnabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
              } ${autoForwardSaving ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-200 ${
                  autoForwardEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        )}

        {showAutoForwardToClient && onToggleAutoForwardToClient && (
          <div
            className={`flex h-full flex-col gap-3 rounded-xl border px-4 py-3.5 transition sm:flex-row sm:items-center sm:justify-between ${
              autoForwardToClientEnabled
                ? "border-sky-200 bg-sky-50/50 dark:border-sky-900/40 dark:bg-sky-950/20"
                : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
            }`}
          >
            <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  autoForwardToClientEnabled
                    ? "bg-[#3A99D8] text-white"
                    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                <UserRound size={16} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-800 dark:text-white">
                    Auto Forward to Client
                  </p>
                  <span
                    className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      autoForwardToClientEnabled
                        ? "border-sky-200 bg-sky-50 text-[#2f87c2] dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300"
                        : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {autoForwardToClientEnabled ? "On" : "Off"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {autoForwardToClientEnabled
                    ? "Lender document requests appear on the client portal automatically."
                    : "Lender requests stay with you first. Forward to the client when ready."}
                </p>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={autoForwardToClientEnabled}
              aria-label="Toggle Auto Forward to Client"
              disabled={autoForwardToClientSaving}
              onClick={onToggleAutoForwardToClient}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 self-end sm:self-center ${
                autoForwardToClientEnabled
                  ? "bg-[#3A99D8]"
                  : "bg-slate-300 dark:bg-slate-600"
              } ${autoForwardToClientSaving ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-200 ${
                  autoForwardToClientEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        )}
      </div>

      {manualSendSlot ? <div>{manualSendSlot}</div> : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
            <Filter size={15} className="text-[#3A99D8]" />
            <span className="text-sm font-semibold">Filter & search</span>
            {hasActiveFilters && (
              <span className="rounded-md bg-[#3A99D8]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#2f87c2]">
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
          <div
            className={
              visibleLenderFilters
                ? "md:col-span-2 xl:col-span-4"
                : "md:col-span-2 xl:col-span-5"
            }
          >
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
                className={searchInputClass}
              />
              {searchInput.trim() ? (
                <button
                  type="button"
                  onClick={() => {
                    onSearchInputChange("");
                    onResetPage();
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>
          </div>

          {showSourceFilter ? (
            <div
              className={
                visibleLenderFilters ? "xl:col-span-2" : "xl:col-span-3"
              }
            >
              <label htmlFor="doc-source-filter" className={labelClass}>
                Source
              </label>
              <div className="relative">
                <UserRound
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <select
                  id="doc-source-filter"
                  value={documentSourceFilter}
                  onChange={(e) => {
                    onDocumentSourceFilterChange(
                      e.target.value as DocumentSourceFilter,
                    );
                    onResetPage();
                  }}
                  className={selectClass}
                >
                  <option value="all">All sources</option>
                  <option value="broker">{brokerSourceFilterLabel}</option>
                  <option value="lender">Lender requested</option>
                  <option value="sub_broker">{coBrokerSourceFilterLabel}</option>
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
              </div>
            </div>
          ) : null}

          {visibleLenderFilters && (
            <div className="xl:col-span-3">
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

          {showSentFilter && (
            <div
              className={
                visibleLenderFilters
                  ? "xl:col-span-3"
                  : showSourceFilter
                    ? "md:col-span-2 xl:col-span-4"
                    : "md:col-span-2 xl:col-span-7"
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
                  <option value="sent_to_client">Sent to client</option>
                  <option value="not_sent_to_client">Not sent to client</option>
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
