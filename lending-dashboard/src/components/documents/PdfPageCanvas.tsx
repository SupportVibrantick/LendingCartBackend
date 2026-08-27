import { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type PdfPageCanvasProps = {
  fileUrl: string;
  mimeType?: string | null;
  pageNumber: number;
  widthPt: number;
  heightPt: number;
  scale: number;
  authHeaders?: Record<string, string>;
  onRendered?: (size: { width: number; height: number }) => void;
  children?: React.ReactNode;
};

async function fetchFileBlob(
  fileUrl: string,
  authHeaders?: Record<string, string>,
) {
  const res = await fetch(fileUrl, {
    headers: authHeaders || {},
  });
  if (!res.ok) {
    throw new Error("Failed to load document preview");
  }
  return res.blob();
}

export default function PdfPageCanvas({
  fileUrl,
  mimeType,
  pageNumber,
  widthPt,
  heightPt,
  scale,
  authHeaders,
  onRendered,
  children,
}: PdfPageCanvasProps) {
  const docCacheRef = useRef<{ url: string; data: ArrayBuffer } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const displayWidth = Math.max(1, Math.round(widthPt * scale));
  const displayHeight = Math.max(1, Math.round(heightPt * scale));

  const authHeaderKey = JSON.stringify(authHeaders || {});

  useEffect(() => {
    let cancelled = false;

    const render = async () => {
      try {
        setLoading(true);
        setError(null);
        let data: ArrayBuffer;
        if (docCacheRef.current?.url === fileUrl) {
          data = docCacheRef.current.data;
        } else {
          const blob = await fetchFileBlob(fileUrl, authHeaders);
          data = await blob.arrayBuffer();
          docCacheRef.current = { url: fileUrl, data };
        }
        if (cancelled) return;

        const isPdf =
          (mimeType || "").includes("pdf") ||
          fileUrl.toLowerCase().includes(".pdf");

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        if (!isPdf) {
          const blob = new Blob([data]);
          const url = URL.createObjectURL(blob);
          const img = new Image();
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("Failed to load image"));
            img.src = url;
          });
          if (cancelled) {
            URL.revokeObjectURL(url);
            return;
          }
          canvas.width = displayWidth;
          canvas.height = displayHeight;
          ctx.clearRect(0, 0, displayWidth, displayHeight);
          ctx.drawImage(img, 0, 0, displayWidth, displayHeight);
          URL.revokeObjectURL(url);
          onRendered?.({ width: displayWidth, height: displayHeight });
          setLoading(false);
          return;
        }

        const pdf = await pdfjs.getDocument({ data: data.slice(0) }).promise;
        const page = await pdf.getPage(pageNumber);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({
          scale: displayWidth / base.width,
        });
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, displayWidth, displayHeight);
        const scaleY = displayHeight / viewport.height;
        ctx.save();
        if (Math.abs(viewport.height - displayHeight) > 1) {
          ctx.scale(1, scaleY);
        }
        await page.render({
          canvasContext: ctx,
          viewport,
        } as any).promise;
        ctx.restore();
        if (cancelled) return;
        onRendered?.({ width: displayWidth, height: displayHeight });
        setLoading(false);
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message || "Failed to render page");
        setLoading(false);
      }
    };

    render();
    return () => {
      cancelled = true;
    };
  }, [
    fileUrl,
    mimeType,
    pageNumber,
    scale,
    displayWidth,
    displayHeight,
    authHeaderKey,
  ]);

  return (
    <div
      className="relative inline-block border border-slate-200 bg-white shadow-md"
      style={{ width: displayWidth, height: displayHeight }}
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute left-0 top-0 block"
        width={displayWidth}
        height={displayHeight}
        style={{ width: displayWidth, height: displayHeight }}
      />
      {loading && (
        <div className="pointer-events-none absolute inset-0 z-[3] flex items-center justify-center bg-white/70 text-sm text-slate-600">
          Loading page…
        </div>
      )}
      {error && (
        <div className="absolute inset-0 z-[3] flex items-center justify-center bg-white/80 p-4 text-center text-sm text-red-600">
          {error}
        </div>
      )}
      <div className="absolute inset-0 z-[2]">{children}</div>
    </div>
  );
}
