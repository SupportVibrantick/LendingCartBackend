import { useEffect, useState } from "react";
import { Archive, FileText, Loader2, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import PageMeta from "../../components/common/PageMeta";
import { getLenderAuthHeaders, LENDER_API_BASE } from "../../lib/lenderApi";

type LibraryTemplate = {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  fieldCount?: number;
  pageCount?: number;
  templateFileName?: string;
  updatedAt?: string;
};

// Share one in-flight list across React Strict Mode remounts.
let inflightTemplates: Promise<LibraryTemplate[]> | null = null;

async function fetchSignFormTemplates(force = false) {
  if (!force && inflightTemplates) {
    return inflightTemplates;
  }

  const request = (async () => {
    const res = await fetch(`${LENDER_API_BASE}/lender/sign-form-templates`, {
      headers: getLenderAuthHeaders(),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message || "Failed to load templates");
    }
    return (json.data || []) as LibraryTemplate[];
  })().finally(() => {
    inflightTemplates = null;
  });

  inflightTemplates = request;
  return request;
}

function formatUpdatedAt(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function EmptyCell({ label }: { label: string }) {
  return (
    <span className="text-[12px] font-medium italic text-text-secondary/70">
      {label}
    </span>
  );
}

export default function SignFormTemplates() {
  const [rows, setRows] = useState<LibraryTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const load = async (options?: {
    force?: boolean;
    isActive?: () => boolean;
  }) => {
    try {
      if (!options?.isActive || options.isActive()) {
        setLoading(true);
      }
      const data = await fetchSignFormTemplates(Boolean(options?.force));
      if (options?.isActive && !options.isActive()) return;
      setRows(data);
    } catch (err: any) {
      if (options?.isActive && !options.isActive()) return;
      toast.error(err.message || "Failed to load templates");
    } finally {
      if (!options?.isActive || options.isActive()) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    let active = true;
    void load({ isActive: () => active });
    return () => {
      active = false;
    };
  }, []);

  const archive = async (id: string) => {
    try {
      setArchivingId(id);
      const res = await fetch(
        `${LENDER_API_BASE}/lender/sign-form-templates/${id}`,
        {
          method: "PATCH",
          headers: getLenderAuthHeaders(true),
          body: JSON.stringify({ status: "ARCHIVED" }),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to archive template");
      }
      toast.success("Template archived");
      await load({ force: true });
    } catch (err: any) {
      toast.error(err.message || "Failed to archive template");
    } finally {
      setArchivingId(null);
    }
  };

  return (
    <>
      <PageMeta
        title="Form templates | Loan Automation"
        description="Reusable fillable sign-document templates"
      />

      <div className="space-y-4 text-text-primary dark:text-slate-100">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="ds-page-title">Form Templates</h1>
            <p className="ds-page-subtitle">
              Save mapped forms once, then reuse them on the next loan from Sign
              Documents.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {!loading ? (
              <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                {rows.length} template{rows.length === 1 ? "" : "s"}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => load({ force: true })}
              disabled={loading}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border text-text-secondary transition hover:bg-surface hover:text-brand-500 disabled:opacity-50 dark:border-slate-700"
              title="Refresh"
              aria-label="Refresh"
            >
              <RefreshCw
                size={15}
                className={loading ? "animate-spin" : ""}
              />
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-white dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-border px-4 py-3.5 dark:border-slate-800 sm:px-5">
            <h2 className="text-[16px] font-semibold text-text-primary dark:text-white">
              Template library
            </h2>
            <p className="text-[13px] text-text-secondary">
              Published templates available for reuse on sign documents.
            </p>
          </div>

          {loading ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 px-5 py-14 text-text-secondary">
              <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
              <p className="text-xs">Loading templates…</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
                <FileText className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold text-text-primary dark:text-slate-100">
                No published templates yet
              </p>
              <p className="mt-1.5 max-w-md text-xs leading-relaxed text-text-secondary">
                Open a sign document, map fields, then click{" "}
                <span className="font-semibold text-text-primary">
                  Save template
                </span>{" "}
                to add it here for reuse.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ds-table min-w-[720px] w-full">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Pages</th>
                    <th>Fields</th>
                    <th>Updated</th>
                    <th className="!text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const updated = formatUpdatedAt(row.updatedAt);
                    return (
                      <tr key={row.id}>
                        <td>
                          <div className="flex min-w-0 items-start gap-2.5">
                            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
                              <FileText className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                              {row.name?.trim() ? (
                                <p
                                  className="ds-table-title"
                                  title={row.name}
                                >
                                  {row.name}
                                </p>
                              ) : (
                                <EmptyCell label="Untitled template" />
                              )}
                              <p className="ds-table-meta">
                                {row.templateFileName || "PDF template"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="tabular-nums ds-table-muted">
                          {row.pageCount != null ? (
                            row.pageCount
                          ) : (
                            <EmptyCell label="Not set" />
                          )}
                        </td>
                        <td className="tabular-nums ds-table-muted">
                          {row.fieldCount != null ? (
                            row.fieldCount
                          ) : (
                            <EmptyCell label="Not set" />
                          )}
                        </td>
                        <td className="ds-table-muted">
                          {updated || <EmptyCell label="Not set" />}
                        </td>
                        <td className="text-right">
                          <button
                            type="button"
                            onClick={() => archive(row.id)}
                            disabled={archivingId === row.id}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-text-primary transition hover:bg-surface disabled:opacity-50 dark:border-slate-700"
                          >
                            {archivingId === row.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Archive className="h-3.5 w-3.5" />
                            )}
                            Archive
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
