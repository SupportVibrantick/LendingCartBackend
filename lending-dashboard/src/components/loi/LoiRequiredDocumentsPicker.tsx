import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import {
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
  onProductRequiredLoaded,
}: Props) {
  const [catalogNames, setCatalogNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const handleProductRequiredLoaded = useCallback(
    (requiredNames: string[]) => {
      onProductRequiredLoaded?.(requiredNames);
    },
    [onProductRequiredLoaded],
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const catalog = await fetchLoiDocumentCatalog(getAuthHeaders, {
          loanProductCode,
          includeProductConfig,
        });
        if (cancelled) return;
        setCatalogNames(
          mergeLoiDocumentNames(
            LOI_DEFAULT_DOCUMENTS,
            catalog.names,
          ),
        );
        handleProductRequiredLoaded(catalog.productRequired);
      } catch {
        if (!cancelled) {
          setCatalogNames([...LOI_DEFAULT_DOCUMENTS]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getAuthHeaders, loanProductCode, includeProductConfig, handleProductRequiredLoaded]);

  const visibleOptions = useMemo(() => {
    const merged = mergeLoiDocumentNames(catalogNames, selectedDocuments);
    const query = search.trim().toLowerCase();
    if (!query) return merged;
    return merged.filter((name) => name.toLowerCase().includes(query));
  }, [catalogNames, selectedDocuments, search]);

  const toggleDocument = (documentName: string) => {
    const exists = selectedDocuments.includes(documentName);
    onSelectedDocumentsChange(
      exists
        ? selectedDocuments.filter((item) => item !== documentName)
        : [...selectedDocuments, documentName],
    );
  };

  const addCustomDocument = () => {
    const next = customDocument.trim();
    if (!next) return;

    const exists = selectedDocuments.some(
      (item) => item.toLowerCase() === next.toLowerCase(),
    );
    if (exists) {
      onCustomDocumentChange("");
      return;
    }

    onSelectedDocumentsChange([...selectedDocuments, next]);
    onCustomDocumentChange("");
  };

  return (
    <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Required Documents
          </label>
          <p className="mt-1 text-xs text-slate-500">
            Select platform, admin, product, or custom documents. Multiple
            selections are supported and appear on the generated term sheet.
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

      {visibleOptions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {visibleOptions.map((documentName) => {
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
                {active ? "✓ " : ""}
                {documentName}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-xs text-slate-500 dark:border-slate-700">
          {loading
            ? "Loading document catalog..."
            : search.trim()
              ? `No documents match "${search.trim()}".`
              : "No catalog documents found. Add a custom document below."}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={customDocument}
          onChange={(e) => onCustomDocumentChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustomDocument();
            }
          }}
          placeholder="Add custom document"
          className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0F766E] dark:border-slate-700 dark:bg-slate-800"
        />
        <button
          type="button"
          onClick={addCustomDocument}
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
        >
          Add
        </button>
      </div>

      {error ? (
        <p className="mt-2 text-xs text-red-500">{error}</p>
      ) : (
        <p className="mt-2 text-[11px] text-slate-400">
          {selectedDocuments.length} document
          {selectedDocuments.length === 1 ? "" : "s"} selected
        </p>
      )}
    </div>
  );
}
