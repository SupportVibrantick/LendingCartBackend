import { useEffect, useRef, useState } from "react";

export function revokeBlobUrl(url: string | null | undefined) {
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

export async function fetchFileAsBlobUrl(
  url: string,
  headers?: HeadersInit,
): Promise<string> {
  // Public static files do not need auth; Authorization can trigger CORS
  // failures on static asset responses (common cause of broken PDF iframes).
  const isPublicStatic =
    /\/public\//i.test(url) ||
    /\/uploads\//i.test(url) ||
    /\/(broker|lender)\/LOI\//i.test(url);
  const res = await fetch(url, {
    headers:
      url.startsWith("blob:") || isPublicStatic ? undefined : headers,
  });
  if (!res.ok) {
    throw new Error(`Failed to load file (${res.status})`);
  }
  const blob = await res.blob();
  // Ensure PDF previews get a PDF MIME so Chrome's viewer accepts the blob.
  const typed =
    blob.type && blob.type !== "application/octet-stream"
      ? blob
      : /\.pdf(\?|$)/i.test(url)
        ? blob.slice(0, blob.size, "application/pdf")
        : blob;
  return URL.createObjectURL(typed);
}

export function useEmbeddedFilePreview(
  remoteUrl: string | null | undefined,
  getHeaders?: () => HeadersInit,
) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const getHeadersRef = useRef(getHeaders);

  getHeadersRef.current = getHeaders;

  useEffect(() => {
    if (!remoteUrl) {
      setBlobUrl((prev) => {
        revokeBlobUrl(prev);
        return null;
      });
      setError(null);
      setLoading(false);
      return;
    }

    if (remoteUrl.startsWith("blob:")) {
      setBlobUrl(remoteUrl);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let createdBlobUrl: string | null = null;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        createdBlobUrl = await fetchFileAsBlobUrl(
          remoteUrl,
          getHeadersRef.current?.(),
        );
        if (cancelled) {
          revokeBlobUrl(createdBlobUrl);
          return;
        }
        setBlobUrl((prev) => {
          revokeBlobUrl(prev);
          return createdBlobUrl;
        });
      } catch (err: unknown) {
        if (!cancelled) {
          setBlobUrl((prev) => {
            revokeBlobUrl(prev);
            return null;
          });
          setError(
            err instanceof Error ? err.message : "Failed to load preview",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      revokeBlobUrl(createdBlobUrl);
      setBlobUrl((prev) => {
        revokeBlobUrl(prev);
        return null;
      });
    };
  }, [remoteUrl]);

  return { blobUrl, loading, error };
}
