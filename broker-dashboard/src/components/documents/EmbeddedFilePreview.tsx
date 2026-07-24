import { ExternalLink, FileText, Loader2 } from "lucide-react";
import { useEmbeddedFilePreview } from "../../lib/useEmbeddedFilePreview";

type EmbeddedFilePreviewProps = {
  remoteUrl: string | null | undefined;
  mimeType?: string | null;
  fileName?: string | null;
  getAuthHeaders?: () => HeadersInit;
  className?: string;
  iframeClassName?: string;
  imageClassName?: string;
};

export default function EmbeddedFilePreview({
  remoteUrl,
  mimeType,
  fileName,
  getAuthHeaders,
  className = "flex h-full w-full flex-1 items-center justify-center bg-white",
  iframeClassName = "h-full min-h-[480px] w-full flex-1 bg-white",
  imageClassName = "max-h-full max-w-full rounded-xl object-contain shadow",
}: EmbeddedFilePreviewProps) {
  const { blobUrl, loading, error } = useEmbeddedFilePreview(
    remoteUrl,
    getAuthHeaders,
  );

  if (loading) {
    return (
      <div className={className}>
        <span className="inline-flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
          Loading preview...
        </span>
      </div>
    );
  }

  if (error || !blobUrl) {
    return (
      <div className={`${className} flex-col gap-3 p-6 text-center`}>
        <FileText className="h-10 w-10 text-slate-400" />
        <p className="text-sm text-slate-600">
          {error || "Preview unavailable"}
        </p>
        {remoteUrl && (
          <a
            href={remoteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
          >
            <ExternalLink size={15} />
            Open in new tab
          </a>
        )}
      </div>
    );
  }

  if (mimeType?.includes("image")) {
    return (
      <div className={className}>
        <img
          src={blobUrl}
          alt={fileName || "Document preview"}
          className={imageClassName}
        />
      </div>
    );
  }

  if (mimeType?.includes("pdf")) {
    return (
      <iframe
        src={blobUrl}
        title={fileName || "Document preview"}
        className={iframeClassName}
      />
    );
  }

  return (
    <div className={`${className} flex-col gap-3 p-6 text-center`}>
      <FileText className="h-10 w-10 text-slate-400" />
      <p className="text-sm text-slate-500">Preview not supported</p>
      {remoteUrl && (
        <a
          href={remoteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ExternalLink size={15} />
          Open file
        </a>
      )}
    </div>
  );
}
