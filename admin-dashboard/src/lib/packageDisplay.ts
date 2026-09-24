/** UI label for subscription package codes (DB keeps BASIC; UI shows STARTER). */
export function getPackageCodeLabel(code?: string | null) {
  const normalized = String(code || "").trim().toUpperCase();
  if (!normalized) return "—";
  if (normalized === "BASIC") return "STARTER";
  return normalized;
}
