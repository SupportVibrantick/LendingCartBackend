export const EQUIPMENT_FINANCE_LOAN_TYPE = "EQUIPMENT_FINANCE";
export const PURCHASE_ORDER_FINANCE_LOAN_TYPE = "PURCHASE_ORDER_FINANCE";
export const ACCOUNTS_RECEIVABLE_FINANCE_LOAN_TYPE = "ACCOUNTS_RECEIVABLE_FINANCE";
export const ACCOUNTS_RECEIVABLE_LOAN_TYPE = "ACCOUNTS_RECEIVABLE";
export const ACCOUNTS_PAYABLE_FINANCE_LOAN_TYPE = "ACCOUNTS_PAYABLE_FINANCE";

export const ACCOUNTS_RECEIVABLE_LOAN_TYPES = new Set([
  ACCOUNTS_RECEIVABLE_FINANCE_LOAN_TYPE,
  ACCOUNTS_RECEIVABLE_LOAN_TYPE,
]);

export const ABL_BASE44_LOAN_TYPES = new Set([
  EQUIPMENT_FINANCE_LOAN_TYPE,
  PURCHASE_ORDER_FINANCE_LOAN_TYPE,
  ACCOUNTS_RECEIVABLE_FINANCE_LOAN_TYPE,
  ACCOUNTS_RECEIVABLE_LOAN_TYPE,
  ACCOUNTS_PAYABLE_FINANCE_LOAN_TYPE,
]);

/* ================= Per-product Business / Industry Type options ================= */

/** Equipment Finance */
export const EQUIPMENT_FINANCE_BUSINESS_TYPES = [
  "Construction",
  "Transportation",
  "Manufacturing",
  "Technology",
  "Healthcare",
  "Restaurant/Hospitality",
  "Agriculture",
  "Automotive",
  "Energy/Oil & Gas",
  "Printing/Graphics",
  "Warehouse/Distribution",
] as const;

/** Purchase Order Finance */
export const PURCHASE_ORDER_FINANCE_BUSINESS_TYPES = [
  "Importers/Exporters",
  "Wholesalers/Distributors",
  "Manufacturers/Assemblers",
  "Resellers/Outsourcers",
  "Government Contractors",
  "Seasonal Retailers",
] as const;

/** Accounts Receivable Finance */
export const ACCOUNTS_RECEIVABLE_BUSINESS_TYPES = [
  "Manufacturing",
  "Distribution/Wholesale",
  "Staffing/Recruiting",
  "Professional Services",
  "Transportation/Logistics",
  "Oil & Gas",
  "Government Contractors",
  "Healthcare",
  "Construction/Trades",
  "Wholesale Trades",
] as const;

/** Accounts Payable Finance */
export const ACCOUNTS_PAYABLE_BUSINESS_TYPES = [
  "Large Manufacturers",
  "Retail Chains",
  "Distributors",
  "Food & Beverage",
  "Automotive",
] as const;

/**
 * Map of loan product code -> business-type option list shown in the
 * "Business / Industry Type" select on the collateral step for ABL products.
 */
export const ABL_PROPERTY_TYPE_OPTIONS_BY_PRODUCT: Record<string, readonly string[]> = {
  [EQUIPMENT_FINANCE_LOAN_TYPE]: EQUIPMENT_FINANCE_BUSINESS_TYPES,
  [PURCHASE_ORDER_FINANCE_LOAN_TYPE]: PURCHASE_ORDER_FINANCE_BUSINESS_TYPES,
  [ACCOUNTS_RECEIVABLE_FINANCE_LOAN_TYPE]: ACCOUNTS_RECEIVABLE_BUSINESS_TYPES,
  [ACCOUNTS_RECEIVABLE_LOAN_TYPE]: ACCOUNTS_RECEIVABLE_BUSINESS_TYPES,
  [ACCOUNTS_PAYABLE_FINANCE_LOAN_TYPE]: ACCOUNTS_PAYABLE_BUSINESS_TYPES,
};

export const isEquipmentFinanceProduct = (product: string) =>
  product === EQUIPMENT_FINANCE_LOAN_TYPE;

export const isPurchaseOrderFinanceProduct = (product: string) =>
  product === PURCHASE_ORDER_FINANCE_LOAN_TYPE;

export const isAccountsReceivableProduct = (product: string) =>
  ACCOUNTS_RECEIVABLE_LOAN_TYPES.has(product);

export const isAccountsPayableProduct = (product: string) =>
  product === ACCOUNTS_PAYABLE_FINANCE_LOAN_TYPE;

export const isAblBase44Product = (product: string) =>
  ABL_BASE44_LOAN_TYPES.has(product);

/** Purchase price on property step — all purposes except refinance. */
export const showEquipmentFinancePurchasePrice = (purpose: string) =>
  purpose !== "Refinance/Consolidation";

/** Current market value on property step for refinance/consolidation. */
export const showEquipmentFinanceMarketValue = (purpose: string) =>
  purpose === "Refinance/Consolidation";

/** Purchase price on property step for ABL Base44 products. */
export const showAblBase44PurchasePrice = (product: string, purpose: string) => {
  if (!isAblBase44Product(product)) return false;
  if (isEquipmentFinanceProduct(product))
    return showEquipmentFinancePurchasePrice(purpose);
  return true;
};
