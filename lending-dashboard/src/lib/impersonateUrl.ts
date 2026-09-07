/**
 * Build impersonation URLs using the hash fragment so JWTs are not sent to nginx
 * in the request line (avoids ERR_CONNECTION_CLOSED on long query strings).
 */
export function buildImpersonatePortalUrl(
  basePath: string,
  params: Record<string, string>,
): string {
  const payload = new URLSearchParams(params).toString();
  return `${basePath}#${payload}`;
}

/**
 * Read impersonation params from the URL hash, with query-string fallback for
 * older links opened before the hash-based change.
 */
export function readImpersonateParams(): URLSearchParams {
  const hash = window.location.hash.replace(/^#/, "").trim();
  if (hash) {
    return new URLSearchParams(hash);
  }

  return new URLSearchParams(window.location.search);
}
