/**
 * Resolve API URLs for files stored under backend/public (LOI PDFs, etc.).
 * DB paths like /broker/LOI/file.pdf are served at /public/broker/LOI/file.pdf
 * and optionally at /broker/LOI/file.pdf when static aliases are enabled.
 */
export function buildApiPublicFileUrl(
  apiBase: string,
  fileUrl?: string | null,
): string | null {
  if (!fileUrl) return null;

  if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
    return fileUrl;
  }

  const normalizedBase = apiBase.replace(/\/+$/, "");

  if (fileUrl.startsWith("/public/")) {
    return `${normalizedBase}${fileUrl}`;
  }

  if (fileUrl.startsWith("/broker/") || fileUrl.startsWith("/lender/")) {
    return `${normalizedBase}/public${fileUrl}`;
  }

  if (fileUrl.startsWith("/uploads/")) {
    return `${normalizedBase}${fileUrl}`;
  }

  return `${normalizedBase}${fileUrl.startsWith("/") ? fileUrl : `/${fileUrl}`}`;
}
