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
