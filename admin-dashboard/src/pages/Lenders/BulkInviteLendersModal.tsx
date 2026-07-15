import { useMemo, useRef, useState } from "react";
import { Download, FileUp, Upload, X, CheckCircle2, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";

type BulkRow = {
  companyName: string;
  fullName: string;
  email: string;
  phone: string;
};

type ValidatedRow = BulkRow & {
  rowNumber: number;
  valid: boolean;
  errors: string[];
};

type Props = {
  apiBase: string;
  getAuthHeaders: () => Record<string, string>;
  onClose: () => void;
  onComplete?: () => void;
};

const TEMPLATE_HEADERS = ["companyName", "fullName", "email", "phone"] as const;

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function normalizeHeader(header: string) {
  return header
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

const HEADER_ALIASES: Record<string, keyof BulkRow> = {
  companyname: "companyName",
  company: "companyName",
  fullname: "fullName",
  name: "fullName",
  email: "email",
  phone: "phone",
  phonenumber: "phone",
};

function parseCsvText(text: string): BulkRow[] {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error("CSV must include a header row and at least one data row");
  }

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const mappedIndexes = headers.map((header) => HEADER_ALIASES[header] || null);

  if (!mappedIndexes.includes("companyName") || !mappedIndexes.includes("email")) {
    throw new Error(
      "CSV headers must include companyName, fullName, email, phone",
    );
  }

  const rows: BulkRow[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = parseCsvLine(lines[i]);
    const row: BulkRow = {
      companyName: "",
      fullName: "",
      email: "",
      phone: "",
    };

    mappedIndexes.forEach((key, index) => {
      if (!key) return;
      row[key] = String(cells[index] ?? "").trim();
    });

    if (!row.companyName && !row.fullName && !row.email && !row.phone) {
      continue;
    }

    rows.push({
      ...row,
      email: row.email.toLowerCase(),
      phone: row.phone.replace(/\D/g, ""),
    });
  }

  return rows;
}

function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function BulkInviteLendersModal({
  apiBase,
  getAuthHeaders,
  onClose,
  onComplete,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState<"upload" | "preview" | "result">("upload");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [validated, setValidated] = useState<ValidatedRow[]>([]);
  const [validating, setValidating] = useState(false);
  const [sending, setSending] = useState(false);
  const [resultSummary, setResultSummary] = useState<{
    createdCount: number;
    failedCount: number;
    failed: Array<{ rowNumber: number; email?: string | null; errors: string[] }>;
  } | null>(null);

  const validCount = useMemo(
    () => validated.filter((row) => row.valid).length,
    [validated],
  );
  const invalidCount = useMemo(
    () => validated.filter((row) => !row.valid).length,
    [validated],
  );

  const downloadTemplate = async () => {
    try {
      const res = await fetch(`${apiBase}/admin/invite-lenders/bulk/template`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to download template");
      const text = await res.text();
      downloadTextFile("lender-invite-template.csv", text, "text/csv;charset=utf-8");
    } catch (err: any) {
      // fallback local template
      const csv = `${TEMPLATE_HEADERS.join(",")}\nABC Capital,Jane Doe,jane@abccapital.com,5551234567\nXYZ Lending,John Smith,john@xyzlending.com,5559876543\n`;
      downloadTextFile("lender-invite-template.csv", csv, "text/csv;charset=utf-8");
      if (err?.message) toast.error(err.message);
    }
  };

  const handleFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseCsvText(text);
      if (!parsed.length) {
        throw new Error("No data rows found in CSV");
      }
      if (parsed.length > 500) {
        throw new Error("Maximum 500 rows allowed per upload");
      }
      setFileName(file.name);
      setRows(parsed);
      setValidated([]);
      setResultSummary(null);
      setStep("preview");
      toast.success(`Loaded ${parsed.length} row(s)`);
    } catch (err: any) {
      toast.error(err.message || "Failed to parse CSV");
    }
  };

  const validateRows = async () => {
    try {
      setValidating(true);
      const res = await fetch(`${apiBase}/admin/invite-lenders/bulk/validate`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ rows }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Validation failed");
      }
      setValidated(json.data.rows || []);
      toast.success(
        `${json.data.validCount} valid, ${json.data.invalidCount} invalid`,
      );
    } catch (err: any) {
      toast.error(err.message || "Validation failed");
    } finally {
      setValidating(false);
    }
  };

  const sendInvites = async () => {
    const rowsToSend =
      validated.length > 0
        ? validated.filter((row) => row.valid).map(({ companyName, fullName, email, phone }) => ({
            companyName,
            fullName,
            email,
            phone,
          }))
        : rows;

    if (!rowsToSend.length) {
      toast.error("No valid rows to invite. Validate first.");
      return;
    }

    try {
      setSending(true);
      const res = await fetch(`${apiBase}/admin/invite-lenders/bulk`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ rows: rowsToSend, skipInvalid: true }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Bulk invite failed");
      }

      setResultSummary({
        createdCount: json.data.createdCount || 0,
        failedCount: json.data.failedCount || 0,
        failed: json.data.failed || [],
      });
      setStep("result");
      toast.success(json.message || "Invitations queued");
      onComplete?.();
    } catch (err: any) {
      toast.error(err.message || "Bulk invite failed");
    } finally {
      setSending(false);
    }
  };

  const previewRows = validated.length > 0 ? validated : rows.map((row, index) => ({
    ...row,
    rowNumber: index + 1,
    valid: true,
    errors: [] as string[],
  }));

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between bg-[#13538A] px-6 py-4 text-white">
          <div>
            <h2 className="text-lg font-semibold">Bulk Invite Lenders</h2>
            <p className="text-xs text-white/80">
              Upload CSV → Preview → Validate → Queue invitation emails
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-white/80 hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {step === "upload" && (
            <>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                >
                  <Download size={14} />
                  Download CSV Template
                </button>
              </div>

              <div
                className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center transition hover:border-indigo-400 hover:bg-indigo-50/40 dark:border-slate-700 dark:bg-slate-950"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleFile(file);
                }}
              >
                <FileUp className="mb-3 h-10 w-10 text-indigo-500" />
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Upload lenders CSV
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Columns: companyName, fullName, email, phone (max 500 rows)
                </p>
                <button
                  type="button"
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#13538A] px-4 py-2 text-xs font-semibold text-white"
                >
                  <Upload size={14} />
                  Choose File
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                    e.target.value = "";
                  }}
                />
              </div>
            </>
          )}

          {(step === "preview" || step === "result") && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {fileName || "Uploaded CSV"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {rows.length} row(s)
                    {validated.length > 0 && (
                      <>
                        {" · "}
                        <span className="text-emerald-600">{validCount} valid</span>
                        {" · "}
                        <span className="text-rose-600">{invalidCount} invalid</span>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStep("upload");
                      setRows([]);
                      setValidated([]);
                      setFileName("");
                      setResultSummary(null);
                    }}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-slate-700"
                  >
                    Upload another
                  </button>
                  {step === "preview" && (
                    <>
                      <button
                        type="button"
                        onClick={validateRows}
                        disabled={validating || !rows.length}
                        className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 disabled:opacity-50"
                      >
                        {validating ? "Validating..." : "Validate"}
                      </button>
                      <button
                        type="button"
                        onClick={sendInvites}
                        disabled={sending || !rows.length}
                        className="rounded-lg bg-[#13538A] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {sending
                          ? "Queuing emails..."
                          : `Send ${validated.length ? validCount : rows.length} Invite(s)`}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {step === "result" && resultSummary && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-semibold">
                        {resultSummary.createdCount} invitation email(s) queued
                      </p>
                      <p className="text-xs opacity-80">
                        Background worker will send emails. Invitation status will
                        update as lenders accept/decline.
                      </p>
                      {resultSummary.failedCount > 0 && (
                        <p className="mt-1 text-xs text-rose-700">
                          {resultSummary.failedCount} row(s) failed/skipped.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="max-h-[45vh] overflow-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Company</th>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Email</th>
                        <th className="px-3 py-2">Phone</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row) => (
                        <tr
                          key={row.rowNumber}
                          className="border-t border-slate-100 dark:border-slate-800"
                        >
                          <td className="px-3 py-2 text-xs text-slate-400">
                            {row.rowNumber}
                          </td>
                          <td className="px-3 py-2">{row.companyName || "—"}</td>
                          <td className="px-3 py-2">{row.fullName || "—"}</td>
                          <td className="px-3 py-2">{row.email || "—"}</td>
                          <td className="px-3 py-2">{row.phone || "—"}</td>
                          <td className="px-3 py-2">
                            {validated.length === 0 ? (
                              <span className="text-xs text-slate-400">Pending validation</span>
                            ) : row.valid ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                                <CheckCircle2 size={12} /> Valid
                              </span>
                            ) : (
                              <span className="inline-flex items-start gap-1 text-xs text-rose-600">
                                <AlertCircle size={12} className="mt-0.5 shrink-0" />
                                <span>{row.errors.join("; ")}</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
