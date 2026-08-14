import {
  isConstructionLoanProduct,
  isEquipmentFinanceProduct,
  isFixAndFlipProduct,
  isApSupplyChainProduct,
  isArFactoringProduct,
  isPurchaseOrderFinanceProduct,
  isSba504Product,
  isSba7aBusinessAcquisitionProduct,
  isSba7aEquipmentPurchaseProduct,
  isSba7aGeneralProduct,
  isSba7aRealEstateProduct,
  isSba7aWorkingCapitalProduct,
  isSbaExpressProduct,
  isUsdaBiProduct,
} from "./loanProductCriteriaFields";

/** SBA / USDA / Asset-Based products use Collateral Value; others use Property Value. */
export function usesCollateralValueForLoi(productCode?: string | null) {
  if (!productCode) return false;
  return (
    isSba7aGeneralProduct(productCode) ||
    isSba7aBusinessAcquisitionProduct(productCode) ||
    isSba7aWorkingCapitalProduct(productCode) ||
    isSba7aEquipmentPurchaseProduct(productCode) ||
    isSba7aRealEstateProduct(productCode) ||
    isSbaExpressProduct(productCode) ||
    isSba504Product(productCode) ||
    isUsdaBiProduct(productCode) ||
    isEquipmentFinanceProduct(productCode) ||
    isArFactoringProduct(productCode) ||
    isApSupplyChainProduct(productCode) ||
    isPurchaseOrderFinanceProduct(productCode) ||
    productCode === "ACCOUNTS_RECEIVABLE" ||
    productCode === "ACCOUNTS_RECEIVABLE_FINANCE"
  );
}

/** LTC + ARV (and rehab / after-repair fields) only for construction & rehab loans. */
export function usesRehabConstructionLoiMetrics(productCode?: string | null) {
  return (
    isFixAndFlipProduct(productCode) || isConstructionLoanProduct(productCode)
  );
}

export function getLoiValueFieldLabel(productCode?: string | null) {
  return usesCollateralValueForLoi(productCode)
    ? "Collateral Value"
    : "Property Value";
}
