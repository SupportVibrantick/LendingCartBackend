import {
  getCriteriaFieldInputSuffix,
  getCriteriaFieldsForProduct,
  isAgencyMultifamilyProduct,
  isApSupplyChainProduct,
  isArFactoringProduct,
  isCmbsProduct,
  isConstructionLoanProduct,
  isCrePermanentProduct,
  isDscrRentalProduct,
  isEquipmentFinanceProduct,
  isFixAndFlipProduct,
  isNoMinLoanCriteriaProduct,
  isNoTermCriteriaProduct,
  isPreferredEquityProduct,
  isPurchaseOrderFinanceProduct,
  isRentalPortfolioProduct,
  isSba504Product,
  isSba7aEquipmentPurchaseProduct,
  isSba7aMaxLoanOnlyProduct,
  isSba7aRateSpreadProduct,
  isSba7aRealEstateProduct,
  isSba7aWorkingCapitalProduct,
  isUsdaBiProduct,
  mapApiProductToCriteriaForm,
  type CriteriaField,
} from "./loanProductCriteriaFields";

type ProductLike = {
  loanProductCode?: string | null;
  code?: string | null;
  loanProduct?: { code?: string | null; name?: string | null } | null;
  name?: string | null;
  loanProductName?: string | null;
  minTermMonths?: number | null;
  maxTermMonths?: number | null;
  minLoanAmount?: number | null;
  maxLoanAmount?: number | null;
  advanceRatePercent?: number | null;
  transactionFeePercent?: number | null;
  earlyPaymentDiscountPercent?: number | null;
  maxArvPercent?: number | null;
  maxLtcPercent?: number | null;
  maxLtvPercent?: number | null;
  minDscr?: number | null;
  maxRateSpreadPercent?: number | null;
  maxTotalProjectAmount?: number | null;
  maxSba504DebentureAmount?: number | null;
  interestRateRange?: string | null;
};

type AmountFormatter = (amount?: number | null) => string;

const usesYearTerms = (productCode: string) =>
  isDscrRentalProduct(productCode) ||
  isRentalPortfolioProduct(productCode) ||
  isCrePermanentProduct(productCode) ||
  isCmbsProduct(productCode) ||
  isAgencyMultifamilyProduct(productCode) ||
  isSba7aWorkingCapitalProduct(productCode) ||
  isSba7aEquipmentPurchaseProduct(productCode) ||
  isSba7aRealEstateProduct(productCode) ||
  isSba504Product(productCode) ||
  isUsdaBiProduct(productCode);

export const resolveProductCode = (product: ProductLike) =>
  product.loanProductCode ||
  product.loanProduct?.code ||
  product.code ||
  "";

export const formatLoanProductName = (product: ProductLike) => {
  const name =
    product.loanProduct?.name || product.name || product.loanProductName;

  if (!name) return "-";

  return name.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
};

export const getMinAmountLabel = (productCode?: string | null) => {
  if (isPurchaseOrderFinanceProduct(productCode) || isArFactoringProduct(productCode)) {
    return "Min Facility Size";
  }
  if (isApSupplyChainProduct(productCode)) return "Min Program Size";
  if (isEquipmentFinanceProduct(productCode)) return "Min Finance Amount";
  if (isRentalPortfolioProduct(productCode)) return "Min Portfolio Loan";
  if (isPreferredEquityProduct(productCode)) return "Min Investment";
  return "Min Amount";
};

export const getMaxAmountLabel = (productCode?: string | null) => {
  if (isPurchaseOrderFinanceProduct(productCode) || isArFactoringProduct(productCode)) {
    return "Max Facility Size";
  }
  if (isApSupplyChainProduct(productCode)) return "Max Program Size";
  if (isSba7aMaxLoanOnlyProduct(productCode) || isUsdaBiProduct(productCode)) {
    return "Max Loan Amount";
  }
  if (isEquipmentFinanceProduct(productCode)) return "Max Finance Amount";
  if (isRentalPortfolioProduct(productCode)) return "Max Portfolio Loan";
  if (isPreferredEquityProduct(productCode)) return "Max Investment";
  return "Max Amount";
};

export const shouldShowMinAmount = (productCode?: string | null) =>
  !isNoMinLoanCriteriaProduct(productCode);

export const shouldShowMaxAmount = (productCode?: string | null) =>
  !isSba504Product(productCode);

export const formatListTenure = (product: ProductLike) => {
  const productCode = resolveProductCode(product);

  if (isNoTermCriteriaProduct(productCode)) {
    return "N/A";
  }

  const { minTermMonths, maxTermMonths } = product;

  if (!minTermMonths || !maxTermMonths) {
    return "-";
  }

  if (usesYearTerms(productCode)) {
    return `${minTermMonths / 12} - ${maxTermMonths / 12} years`;
  }

  return `${minTermMonths} - ${maxTermMonths} months`;
};

export const formatPercentValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const formatPercentDisplay = (value: unknown) => {
  const parsed = formatPercentValue(value);
  return parsed == null ? "-" : `${parsed}%`;
};

const formatAmountRange = (
  product: ProductLike,
  productCode: string,
  formatAmount: AmountFormatter,
) => {
  if (isSba504Product(productCode)) {
    if (product.maxSba504DebentureAmount) {
      return `Up to ${formatAmount(product.maxSba504DebentureAmount)} debenture`;
    }
    if (product.maxTotalProjectAmount) {
      return `Up to ${formatAmount(product.maxTotalProjectAmount)} project`;
    }
    return null;
  }

  const min = shouldShowMinAmount(productCode) ? product.minLoanAmount : null;
  const max = shouldShowMaxAmount(productCode) ? product.maxLoanAmount : null;

  if (min && max) {
    return `${formatAmount(min)} – ${formatAmount(max)}`;
  }
  if (max) {
    return `Up to ${formatAmount(max)}`;
  }
  if (min) {
    return `From ${formatAmount(min)}`;
  }

  return null;
};

const appendProductHighlights = (
  product: ProductLike,
  productCode: string,
  parts: string[],
) => {
  if (
    isPurchaseOrderFinanceProduct(productCode) ||
    isArFactoringProduct(productCode)
  ) {
    const advance = formatPercentValue(product.advanceRatePercent);
    if (advance != null) {
      parts.push(`${advance}% advance`);
    }
    if (isPurchaseOrderFinanceProduct(productCode)) {
      const fee = formatPercentValue(product.transactionFeePercent);
      if (fee != null) {
        parts.push(`${fee}% fee`);
      }
    }
    return;
  }

  if (isApSupplyChainProduct(productCode)) {
    const discount = formatPercentValue(product.earlyPaymentDiscountPercent);
    if (discount != null) {
      parts.push(`${discount}% early pay disc.`);
    }
    return;
  }

  if (isFixAndFlipProduct(productCode) || isConstructionLoanProduct(productCode)) {
    const arv = formatPercentValue(product.maxArvPercent);
    const ltc = formatPercentValue(product.maxLtcPercent);
    if (arv != null) {
      parts.push(`ARV ${arv}%`);
    }
    if (ltc != null) {
      parts.push(`LTC ${ltc}%`);
    }
    if (product.interestRateRange) {
      parts.push(`${product.interestRateRange}% rate`);
    }
    return;
  }

  if (isSba7aRateSpreadProduct(productCode)) {
    const spread = formatPercentValue(product.maxRateSpreadPercent);
    if (spread != null) {
      parts.push(`${spread}% max spread`);
    }
    return;
  }

  if (
    isDscrRentalProduct(productCode) ||
    isRentalPortfolioProduct(productCode) ||
    isCrePermanentProduct(productCode) ||
    isCmbsProduct(productCode) ||
    isAgencyMultifamilyProduct(productCode)
  ) {
    if (product.maxLtvPercent != null) {
      parts.push(`LTV ${product.maxLtvPercent}%`);
    }
    if (product.minDscr != null) {
      parts.push(`DSCR ${product.minDscr}`);
    }
    return;
  }

  if (product.interestRateRange) {
    parts.push(`${product.interestRateRange}% rate`);
  }
};

export const formatListKeyCriteria = (
  product: ProductLike,
  formatAmount: AmountFormatter,
) => {
  const productCode = resolveProductCode(product);
  const parts: string[] = [];

  const amountRange = formatAmountRange(product, productCode, formatAmount);
  if (amountRange) {
    parts.push(amountRange);
  }

  if (!isNoTermCriteriaProduct(productCode)) {
    const tenure = formatListTenure(product);
    if (tenure !== "-" && tenure !== "N/A") {
      parts.push(tenure);
    }
  }

  appendProductHighlights(product, productCode, parts);

  return parts.length ? parts.join(" · ") : "-";
};

export type LoanProductDetailRow = {
  label: string;
  value: string;
  fullWidth?: boolean;
};

const DETAIL_EMPTY = "-";

const CURRENCY_FIELD_KEYS = new Set([
  "minLoan",
  "maxLoan",
  "minFacilitySize",
  "maxFacilitySize",
  "minProgramSize",
  "maxProgramSize",
  "minAnnualRevenue",
  "maxTotalProject",
  "maxSba504Debenture",
  "maxUsdaGuarantee",
  "maximumDebtService",
]);

const formatDetailCurrency = (
  value: unknown,
  formatAmount: AmountFormatter,
) => {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DETAIL_EMPTY;
  }

  return formatAmount(parsed);
};

const formatDetailFieldValue = (
  field: CriteriaField,
  criteria: Record<string, unknown>,
  formatAmount: AmountFormatter,
) => {
  const raw = criteria[field.key];
  const fieldType = field.type || "number";

  if (fieldType === "toggle") {
    if (raw === true) return "Yes";
    if (raw === false) return "No";
    return DETAIL_EMPTY;
  }

  if (fieldType === "textarea" || fieldType === "text") {
    const text = typeof raw === "string" ? raw.trim() : "";
    return text || DETAIL_EMPTY;
  }

  if (raw === null || raw === undefined || raw === "") {
    return DETAIL_EMPTY;
  }

  if (CURRENCY_FIELD_KEYS.has(field.key)) {
    return formatDetailCurrency(raw, formatAmount);
  }

  const suffix = getCriteriaFieldInputSuffix(field);
  if (suffix === "%") {
    return formatPercentDisplay(raw);
  }

  if (suffix === "x" || field.key === "minDscr") {
    return String(raw);
  }

  if (suffix === "yr" || field.label.includes("(years)")) {
    return `${raw} years`;
  }

  if (field.label.includes("(months)")) {
    return `${raw} months`;
  }

  if (field.label.includes("(days)")) {
    return `${raw} days`;
  }

  return String(raw);
};

export const formatLoanProductCode = (product: ProductLike) => {
  const code = resolveProductCode(product);
  if (!code) return DETAIL_EMPTY;

  return code
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

export const buildLoanProductDetailFields = (
  product: ProductLike & Record<string, unknown>,
  formatAmount: AmountFormatter,
): LoanProductDetailRow[] => {
  const productCode = resolveProductCode(product);
  const criteria = mapApiProductToCriteriaForm({
    ...product,
    loanProductCode: productCode,
    code: productCode,
  });

  return getCriteriaFieldsForProduct(productCode).map((field) => ({
    label: field.label,
    value: formatDetailFieldValue(field, criteria, formatAmount),
    fullWidth: field.type === "textarea",
  }));
};
