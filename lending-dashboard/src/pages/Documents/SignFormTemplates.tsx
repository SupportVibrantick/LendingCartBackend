import { useEffect, useState } from "react";
import { Archive, FileText, Loader2, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
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

export default function SignFormTemplates() {
  const [rows, setRows] = useState<LibraryTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${LENDER_API_BASE}/lender/sign-form-templates`, {
        headers: getLenderAuthHeaders(),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load templates");
      }
      setRows(json.data || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
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
      await load();
    } catch (err: any) {
      toast.error(err.message || "Failed to archive template");
    } finally {
      setArchivingId(null);
    }
  };

  return (
    <>
      <PageMeta
        title="Sign form templates | Loan Automation"
        description="Reusable fillable sign-document templates"
      />
      <PageBreadcrumb pageTitle="Sign form templates" />

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Template library
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Save mapped forms once, then reuse them on the next loan from Sign
              Documents.
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex min-h-[180px] items-center justify-center text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading templates…
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
            No published templates yet. Open a sign document, map fields, then
            click <strong>Save template</strong>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Pages</th>
                  <th className="px-3 py-2">Fields</th>
                  <th className="px-3 py-2">Updated</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-3 py-3">
                      <div className="flex items-start gap-2">
                        <FileText className="mt-0.5 h-4 w-4 text-teal-700" />
                        <div>
                          <div className="font-medium text-slate-800 dark:text-slate-100">
                            {row.name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {row.templateFileName || "PDF template"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">{row.pageCount ?? "—"}</td>
                    <td className="px-3 py-3">{row.fieldCount ?? "—"}</td>
                    <td className="px-3 py-3 text-slate-500">
                      {row.updatedAt
                        ? new Date(row.updatedAt).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => archive(row.id)}
                        disabled={archivingId === row.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
