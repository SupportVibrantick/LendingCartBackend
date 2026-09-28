/**
 * Absolute URL to the paid pricing marketing site (separate Vite app).
 * @param {string} [path="/"]
 */
export function getPaidSiteUrl(path = "/") {
  const base = String(
    import.meta.env.VITE_PAID_SITE_URL || "http://localhost:5173",
  ).replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix === "/" ? "" : suffix}` || base;
}
