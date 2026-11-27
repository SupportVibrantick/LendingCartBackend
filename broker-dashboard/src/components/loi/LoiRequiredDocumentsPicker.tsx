import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, FileText, Loader2, Plus, Search, X } from "lucide-react";
import toast from "react-hot-toast";
import {
  createLoiCustomDocument,
  fetchLoiDocumentCatalog,
  mergeLoiDocumentNames,
} from "../../lib/loiDocumentOptions";

type Props = {
  selectedDocuments: string[];
  onSelectedDocumentsChange: (documents: string[]) => void;
  customDocument: string;
  onCustomDocumentChange: (value: string) => void;
  error?: string;
  getAuthHeaders: () => HeadersInit | Record<string, string>;
  loanProductCode?: string | null;
  includeProductConfig?: boolean;
  onProductRequiredLoaded?: (requiredNames: string[]) => void;
  activeChipClassName?: string;
  inactiveChipClassName?: string;
  disabled?: boolean;
};

export default function LoiRequiredDocumentsPicker({
  selectedDocuments,
  onSelectedDocumentsChange,
  customDocument,
  onCustomDocumentChange,
  error,
  getAuthHeaders,
  loanProductCode = null,
  includeProductConfig = true,
  onProductRequiredLoaded,
  activeChipClassName = "border-[#4C78F5] bg-[#4C78F5] text-white",
  inactiveChipClassName = "border-slate-200 bg-white text-slate-700 hover:border-[#4C78F5]/40 hover:bg-[#4C78F5]/5 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-[#4C78F5]/50",
  disabled = false,
}: Props) {
  const [catalogNames, setCatalogNames] = useState<string[]>([]);
  const [customNameKeys, setCustomNameKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [loading, setLoading] = useState(false);
  const [addingCustom, setAddingCustom] = useState(false);
  const [search, setSearch] = useState("");

  const handleProductRequiredLoaded = useCallback(
    (requiredNames: string[]) => {
      onProductRequiredLoaded?.(requiredNames);
    },
    [onProductRequiredLoaded],
  );

  const loadCatalog = useCallback(async () => {
    const catalog = await fetchLoiDocumentCatalog(getAuthHeaders, {
      loanProductCode,
      includeProductConfig,
    });
    setCatalogNames(mergeLoiDocumentNames(catalog.names));
    setCustomNameKeys(
      new Set(
        (catalog.customNames || []).map((name) => name.trim().toLowerCase()),
      ),
    );
    handleProductRequiredLoaded(catalog.productRequired);
    return catalog.names;
  }, [
    getAuthHeaders,
    loanProductCode,
    includeProductConfig,
    handleProductRequiredLoaded,
  ]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        await loadCatalog();
      } catch (err: any) {
        if (!cancelled) {
          setCatalogNames([]);
          setCustomNameKeys(new Set());
          toast.error(err?.message || "Failed to load document catalog");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadCatalog]);

  const catalogKeySet = useMemo(
    () => new Set(catalogNames.map((name) => name.trim().toLowerCase())),
    [catalogNames],
  );

  const selectedKeySet = useMemo(
    () =>
      new Set(selectedDocuments.map((name) => name.trim().toLowerCase())),
    [selectedDocuments],
  );

  const isCustomDocument = useCallback(
    (documentName: string) => {
      const key = documentName.trim().toLowerCase();
      if (!key) return false;
      if (customNameKeys.has(key)) return true;
      return !catalogKeySet.has(key);
    },
    [catalogKeySet, customNameKeys],
  );

  const searchQuery = search.trim().toLowerCase();

  const visibleCatalog = useMemo(() => {
    if (!searchQuery) return catalogNames;
    return catalogNames.filter((name) =>
      name.toLowerCase().includes(searchQuery),
    );
  }, [catalogNames, searchQuery]);

  const toggleDocument = (documentName: string) => {
    if (disabled) return;
    const exists = selectedDocuments.includes(documentName);
    onSelectedDocumentsChange(
      exists
        ? selectedDocuments.filter((item) => item !== documentName)
        : [...selectedDocuments, documentName],
    );
  };

  const clearSelected = () => {
    if (disabled || selectedDocuments.length === 0) return;
    onSelectedDocumentsChange([]);
  };

  const addCustomDocument = async () => {
    if (disabled || addingCustom) return;
    const next = customDocument.trim();
    if (!next) return;

    if (next.length < 2) {
      toast.error("Custom document name must be at least 2 characters");
      return;
    }

    const exists = selectedDocuments.some(
      (item) => item.toLowerCase() === next.toLowerCase(),
    );
    if (exists) {
      onCustomDocumentChange("");
      return;
    }

    if (!loanProductCode?.trim()) {
      toast.error("Loan product is required to save a custom document");
      return;
    }

    try {
      setAddingCustom(true);
      const created = await createLoiCustomDocument(getAuthHeaders, {
        name: next,
        loanProductCode,
      });

      await loadCatalog();
      onSelectedDocumentsChange([
        ...selectedDocuments,
        created.name || next,
      ]);
      onCustomDocumentChange("");
      toast.success(
        created.reused
          ? "Custom document linked to this product"
          : "Custom document saved for this product",
      );
    } catch (err: any) {
      toast.error(err?.message || "Failed to add custom document");
    } finally {
      setAddingCustom(false);
    }
  };

  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-none dark:border-slate-700 dark:bg-slate-950">
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3.5 dark:border-slate-800 dark:bg-slate-900/40 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#4C78F5]/10 text-[#4C78F5]">
            <FileText size={15} />
            </span>
            Required Documents
          </div>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            Pick from this product’s catalog, or add a custom document for your
            brokerage.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        {loading ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
              {selectedDocuments.length} selected
          </span>
          )}
          {selectedDocuments.length > 0 ? (
            <button
              type="button"
              disabled={disabled}
              onClick={clearSelected}
              className="text-sm font-medium text-[#4C78F5] hover:text-[#3B66E0] disabled:opacity-50"
            >
              Clear all
            </button>
        ) : null}
      </div>
      </div>

      <div className="space-y-4 p-4">
      {selectedDocuments.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              Selected
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedDocuments.map((documentName) => (
              <button
                key={`selected-${documentName}`}
                type="button"
                disabled={disabled}
                onClick={() => toggleDocument(documentName)}
                title="Click to remove"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#4C78F5]/30 bg-[#4C78F5]/10 px-2.5 py-1.5 text-sm font-medium text-[#3B66E0] transition hover:bg-[#4C78F5]/15 disabled:cursor-not-allowed disabled:opacity-60 dark:text-sky-300"
                >
                  <Check size={14} className="shrink-0" />
                  <span className="max-w-[220px] truncate">{documentName}</span>
                  {isCustomDocument(documentName) ? (
                    <span className="rounded-full bg-[#4C78F5]/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#4C78F5]">
                      Custom
                    </span>
                  ) : null}
                  <X size={13} className="shrink-0 opacity-70" />
              </button>
            ))}
          </div>
        </div>
      ) : null}

          <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              Catalog
              {!loading ? (
                <span className="ml-1 font-normal normal-case tracking-normal text-slate-400">
                  ({visibleCatalog.length}
                  {searchQuery ? " match" : ""})
                </span>
              ) : null}
            </p>
          </div>

          <div className="relative mb-3">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              disabled={disabled || !loanProductCode}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                loanProductCode
                  ? "Filter documents…"
                  : "Select a loan product to browse documents"
              }
              aria-label="Filter required documents"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#4C78F5]/50 focus:ring-2 focus:ring-[#4C78F5]/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:disabled:bg-slate-900"
            />
            {search.trim() ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                aria-label="Clear document filter"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>

          {!loanProductCode ? (
            <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50/70 px-3.5 py-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
              Choose a loan product first to load the document catalog for this
              term sheet.
            </div>
          ) : loading && catalogNames.length === 0 ? (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 px-3.5 py-10 text-sm text-slate-500 dark:border-slate-700">
              <Loader2 className="h-4 w-4 animate-spin text-[#4C78F5]" />
              Loading document catalog…
            </div>
          ) : visibleCatalog.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 px-3.5 py-6 text-center text-sm text-slate-500 dark:border-slate-700">
              {searchQuery
                ? `No documents match “${search.trim()}”. Try another name or add a custom document below.`
                : "No catalog documents yet for this product. Add a custom document below."}
            </div>
          ) : (
            <div className="custom-scrollbar max-h-52 overflow-y-auto rounded-lg border border-slate-200 p-2.5 dark:border-slate-700">
              <div className="flex flex-wrap gap-2">
                {visibleCatalog.map((documentName) => {
                  const active = selectedKeySet.has(
                    documentName.trim().toLowerCase(),
                  );
                  const custom = isCustomDocument(documentName);
                return (
                  <button
                    key={documentName}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleDocument(documentName)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      active ? activeChipClassName : inactiveChipClassName
                    }`}
                  >
                      {active ? <Check size={14} className="shrink-0" /> : null}
                      <span className="max-w-[220px] truncate">
                        {documentName}
                      </span>
                      {custom ? (
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            active
                              ? "bg-white/20 text-white"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                          }`}
                        >
                          Custom
                        </span>
                      ) : null}
                  </button>
                );
              })}
            </div>
          </div>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/40">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            Add custom document
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={customDocument}
              disabled={disabled || addingCustom || !loanProductCode}
          onChange={(e) => onCustomDocumentChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void addCustomDocument();
            }
          }}
              placeholder="e.g. Rent Roll, Operating Agreement…"
              className="h-10 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#4C78F5]/50 focus:ring-2 focus:ring-[#4C78F5]/15 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
        <button
          type="button"
              disabled={
                disabled ||
                addingCustom ||
                !loanProductCode ||
                !customDocument.trim()
              }
          onClick={() => void addCustomDocument()}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#4C78F5] px-3.5 text-sm font-semibold text-white transition hover:bg-[#3B66E0] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {addingCustom ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Plus size={15} />
              )}
              {addingCustom ? "Adding…" : "Add"}
        </button>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Custom documents stay private to your brokerage and are saved for
            this loan product.
          </p>
      </div>

      {error ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : null}
      </div>
    </div>
  );
}
