import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import toast from "react-hot-toast";
import {
  createLoiCustomDocument,
  fetchLoiDocumentCatalog,
  mergeLoiDocumentNames,
} from "../../lib/loiDocumentOptions";
import { LOI_DEFAULT_DOCUMENTS } from "../../lib/loiUnderwritingTerms";

type Props = {
  selectedDocuments: string[];
  onSelectedDocumentsChange: (documents: string[]) => void;
  customDocument: string;
  onCustomDocumentChange: (value: string) => void;
  error?: string;
  getAuthHeaders: () => Record<string, string>;
  loanProductCode?: string | null;
  includeProductConfig?: boolean;
  /** Why selected chips appear — previous LOI vs user picks only. */
  selectionSource?: "previous" | "none";
  onProductRequiredLoaded?: (requiredNames: string[]) => void;
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
  selectionSource = "none",
  onProductRequiredLoaded,
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
    const names = loanProductCode
      ? mergeLoiDocumentNames(catalog.names)
      : mergeLoiDocumentNames(LOI_DEFAULT_DOCUMENTS, catalog.names);
    setCatalogNames(names);
    setCustomNameKeys(
      new Set(
        (catalog.customNames || []).map((name) => name.trim().toLowerCase()),
      ),
    );
    handleProductRequiredLoaded(catalog.productRequired);
    return names;
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
      } catch {
        if (!cancelled) {
          setCatalogNames(
            loanProductCode ? [] : [...LOI_DEFAULT_DOCUMENTS],
          );
          setCustomNameKeys(new Set());
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadCatalog, loanProductCode]);

  const catalogKeySet = useMemo(
    () => new Set(catalogNames.map((name) => name.trim().toLowerCase())),
    [catalogNames],
  );

  const isCustomDocument = useCallback(
    (documentName: string) => {
      const key = documentName.trim().toLowerCase();
      if (!key) return false;
      if (customNameKeys.has(key)) return true;
      // Selected but not in catalog → treated as lender custom / carried name
      return !catalogKeySet.has(key);
    },
    [catalogKeySet, customNameKeys],
  );

  const searchQuery = search.trim().toLowerCase();

  const searchResults = useMemo(() => {
    if (!searchQuery) return [];
    return catalogNames.filter((name) =>
      name.toLowerCase().includes(searchQuery),
    );
  }, [catalogNames, searchQuery]);

  const selectedHint =
    selectionSource === "previous"
      ? "Copied from the previous LOI version. Custom docs you added earlier are marked Custom — click a chip to remove."
      : "Search and select documents for this LOI. Custom docs are marked Custom — click a chip to remove.";

  const toggleDocument = (documentName: string) => {
    const exists = selectedDocuments.includes(documentName);
    onSelectedDocumentsChange(
      exists
        ? selectedDocuments.filter((item) => item !== documentName)
        : [...selectedDocuments, documentName],
    );
  };

  const addCustomDocument = async () => {
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
      toast.success("Custom document saved for this product");
    } catch (err: any) {
      toast.error(err?.message || "Failed to add custom document");
    } finally {
      setAddingCustom(false);
    }
  };

  const renderChipLabel = (documentName: string, active: boolean) => {
    const custom = isCustomDocument(documentName);
    return (
      <span className="inline-flex items-center gap-1.5">
        <span>
          {active ? "✓ " : ""}
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
      </span>
    );
  };

  return (
    <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Required Documents
          </label>
          <p className="mt-1 text-xs text-slate-500">
            Search to find documents for this loan product. Custom documents you
            add are private to your lender account.
          </p>
        </div>
        {loading ? (
          <span className="inline-flex items-center gap-1 text-xs text-slate-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading...
          </span>
        ) : null}
      </div>

      <div className="relative mb-3">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search documents..."
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#0F766E] dark:border-slate-700 dark:bg-slate-800"
        />
      </div>

      {selectedDocuments.length > 0 ? (
        <div className="mb-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Selected ({selectedDocuments.length})
          </p>
          <p className="mb-2 text-xs text-slate-500">{selectedHint}</p>
          <div className="flex flex-wrap gap-2">
            {selectedDocuments.map((documentName) => (
              <button
                key={`selected-${documentName}`}
                type="button"
                onClick={() => toggleDocument(documentName)}
                className="rounded-full bg-[#0F766E] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#0d5f59]"
                title="Click to remove"
              >
                {renderChipLabel(documentName, true)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {searchQuery ? (
        searchResults.length > 0 ? (
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Search results ({searchResults.length})
            </p>
            <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto">
              {searchResults.map((documentName) => {
                const active = selectedDocuments.includes(documentName);
                return (
                  <button
                    key={documentName}
                    type="button"
                    onClick={() => toggleDocument(documentName)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      active
                        ? "bg-[#0F766E] text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {renderChipLabel(documentName, active)}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-xs text-slate-500 dark:border-slate-700">
            {loading
              ? "Loading document catalog..."
              : `No documents match "${search.trim()}".`}
          </p>
        )
      ) : (
        <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-xs text-slate-500 dark:border-slate-700">
          {loading
            ? "Loading document catalog..."
            : "Type in search to find and select documents."}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={customDocument}
          disabled={addingCustom || !loanProductCode}
          onChange={(e) => onCustomDocumentChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void addCustomDocument();
            }
          }}
          placeholder={
            loanProductCode
              ? "Add custom document"
              : "Loan product required to add custom docs"
          }
          className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0F766E] disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800"
        />
        <button
          type="button"
          disabled={addingCustom || !loanProductCode || !customDocument.trim()}
          onClick={() => void addCustomDocument()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
        >
          {addingCustom ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : null}
          Add
        </button>
      </div>

      {error ? (
        <p className="mt-2 text-xs text-red-500">{error}</p>
      ) : (
        <p className="mt-2 text-[11px] text-slate-400">
          {selectedDocuments.length} document
          {selectedDocuments.length === 1 ? "" : "s"} selected
          {loanProductCode
            ? " · custom docs stay private to your lender account"
            : ""}
        </p>
      )}
    </div>
  );
}
