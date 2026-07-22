import { useCallback, useRef, useState } from "react";
import { Eye, Trash2, Upload } from "lucide-react";
import {
  APPLICATION_DOCUMENT_TYPE_OPTIONS,
  createPendingDocument,
  revokePendingDocumentPreview,
  type ApplicationDocumentType,
  type PendingApplicationDocument,
} from "../../lib/applicationDocumentTypes";

type ResidentialDocumentsStepProps = {
  documents: PendingApplicationDocument[];
  onChange: (documents: PendingApplicationDocument[]) => void;
  uploading?: boolean;
};

export default function ResidentialDocumentsStep({
  documents,
  onChange,
  uploading = false,
}: ResidentialDocumentsStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const addFiles = useCallback(
    (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (files.length === 0) return;

      onChange([...documents, ...files.map(createPendingDocument)]);
    },
    [documents, onChange],
  );

  const removeDocument = (id: string) => {
    const target = documents.find((doc) => doc.id === id);
    if (target) revokePendingDocumentPreview(target);
    onChange(documents.filter((doc) => doc.id !== id));
  };

  const updateDocumentType = (id: string, documentType: ApplicationDocumentType) => {
    onChange(
      documents.map((doc) =>
        doc.id === id ? { ...doc, documentType } : doc,
      ),
    );
  };

  return (
    <div className="mt-5 space-y-6">
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Upload Documents
        </p>

        <div
          role="button"
          tabIndex={0}
          onClick={() => !uploading && inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            if (!uploading && e.dataTransfer.files.length > 0) {
              addFiles(e.dataTransfer.files);
            }
          }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 transition ${
            dragActive
              ? "border-[#2C92D5] bg-[#2C92D5]/5"
              : "border-slate-300 bg-slate-50/50 hover:border-[#2C92D5]/60 dark:border-slate-600 dark:bg-slate-900/20"
          } ${uploading ? "pointer-events-none opacity-60" : ""}`}
        >
          <Upload className="mb-3 h-8 w-8 text-slate-400" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Drag &amp; drop files here or click to upload
          </p>
          <p className="mt-1 text-xs text-slate-500">Multiple files allowed</p>
        </div>

        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.jfif"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="mt-3 flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800 dark:text-slate-300"
        >
          <Upload className="h-4 w-4" />
          Upload Document
        </button>
      </div>

      {documents.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Uploaded Documents
          </p>

          <div className="space-y-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                    {doc.fileName}
                  </p>
                </div>

                <select
                  value={doc.documentType || "Other"}
                  onChange={(e) =>
                    updateDocumentType(
                      doc.id,
                      e.target.value as ApplicationDocumentType,
                    )
                  }
                  disabled={uploading}
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 sm:w-56"
                >
                  <option value="">Select Document Type</option>
                  {APPLICATION_DOCUMENT_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.open(doc.previewUrl, "_blank")}
                    className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </button>

                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => removeDocument(doc.id)}
                    className="flex items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/40 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
