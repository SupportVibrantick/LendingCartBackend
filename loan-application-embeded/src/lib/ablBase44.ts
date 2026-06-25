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
