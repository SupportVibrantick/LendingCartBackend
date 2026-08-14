/** SBA / USDA / Asset-Based products use Collateral Value; others use Property Value. */
export function usesCollateralValueForLoi(productCode?: string | null) {
  if (!productCode) return false;
  const code = String(productCode).toUpperCase();
  return (
    code.includes("SBA") ||
    code.includes("USDA") ||
    code.includes("EQUIPMENT") ||
    code.includes("FACTORING") ||
    code.includes("SUPPLY_CHAIN") ||
    code.includes("PURCHASE_ORDER") ||
    code.includes("ACCOUNTS_RECEIVABLE") ||
    code === "AR_FACTORING" ||
    code === "AP_SUPPLY_CHAIN"
  );
}

/** LTC + ARV (and rehab / after-repair fields) only for construction & rehab loans. */
export function usesRehabConstructionLoiMetrics(productCode?: string | null) {
  if (!productCode) return false;
  const code = String(productCode).toUpperCase();
  return (
    code.includes("FIX_AND_FLIP") ||
    code.includes("FIX_FLIP") ||
    code.includes("CONSTRUCTION")
  );
}

export function getLoiValueFieldLabel(productCode?: string | null) {
  return usesCollateralValueForLoi(productCode)
    ? "Collateral Value"
    : "Property Value";
}
