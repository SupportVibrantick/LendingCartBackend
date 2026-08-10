// Derived metrics for the LoanApplication form. Pure functions only —
// no React state, no side effects. The main component calls
// `computeLoanMetrics` once per render and consumes the returned record
// for the stats banner, equity-mismatch banner, the
// `ResidentialFinancialsStep` annual debt service default, and the
// `submitApplication` payload.
//
// All numeric semantics (string parsing, `.toFixed(2)`, em-dash fallback,
// 0.01 equity tolerance) are preserved verbatim from the previous
// inline block in `LoanApplication.tsx`.

import {
  sumBorrowerAssets,
  sumBorrowerLiabilities,
} from "../../lib/residentialBorrower";
import {
  getResidentialNoiForDscr,
  getResidentialDebtServiceForDscr,
} from "../../lib/residentialFinancials";
import {
  calculateInterestOnlyMonthlyPayment,
  calculateMonthlyPayment,
  toNumber,
} from "./formatters";
import {
  isBridgeProduct,
  isConstruction14Product,
  isConstructionLoanProduct,
  isCreBase44Product,
  isFixAndFlipProduct,
  isRentalUnderwritingProduct,
  isSbaBase44Product,
} from "./productRules";
import type { FormDataType } from "./types";

export interface LoanMetricsContext {
  selectedProduct: string;
  usesBase44Financials: boolean;
  formData: FormDataType;
}

/**
 * Flat record of every derived number the orchestrator needs to render
 * the stats banner, equity-mismatch banner, financials step default, and
 * the submission payload. Field names match what was previously inlined
 * inside `LoanApplication.tsx` so call-sites read as a one-for-one move.
 */
export interface LoanMetrics {
  // Numeric inputs
  loanAmount: number;
  purchasePrice: number;
  marketValue: number;
  rehabCost: number;
  constructionCost: number;
  afterRepairValue: number;
  interestRate: number;
  amortizationYears: number;
  fallbackTermMonths: number;
  termMonths: number;
  monthlyPayment: number;

  // Aggregates
  borrowerAssets: number;
  borrowerLiabilities: number;
  netWorth: number;
  annualPrincipalAndInterest: number;
  annualPropertyTaxes: number;
  annualInsurance: number;
  totalAnnualDebtPayment: number;
  crePermanentNoi: number;
  residentialNoiForDscr: number;
  residentialDebtService: number;
  annualDebtService: number;

  // Equity / down payment
  downPaymentTotal: number;
  hasSellerFinancing: boolean;
  sellerFinancingTotal: number;
  loanAmountTotal: number;
  purchasePriceTotal: number;
  hasPurchasePrice: boolean;
  equityGrandTotal: number;
  equityMismatchError: boolean;

  // Combined project costs
  totalFlipCost: number;
  totalConstructionCost: number;
  asIsValue: number;

  // Formatted ratios (always `string` — `"-"` when undefined)
  ltv: string;
  ltc: string;
  arv: string;
  dscr: string;
  monthlyPaymentDisplay: string;
}

export function computeLoanMetrics(ctx: LoanMetricsContext): LoanMetrics {
  const { selectedProduct, usesBase44Financials, formData } = ctx;

  // -----------------------------------------------------------------
  // Borrower net worth
  // -----------------------------------------------------------------
  const borrowerAssets = usesBase44Financials
    ? sumBorrowerAssets(formData.borrower.assets)
    : toNumber(formData.loanRequest.totalAssets || "0");
  const borrowerLiabilities = usesBase44Financials
    ? sumBorrowerLiabilities(formData.borrower.liabilities)
    : toNumber(formData.loanRequest.totalLiabilities || "0");
  const netWorth = borrowerAssets - borrowerLiabilities;

  // -----------------------------------------------------------------
  // Loan + property numeric inputs
  // -----------------------------------------------------------------
  const loanAmount = toNumber(formData.loanRequest.amount);
  const purchasePrice = toNumber(formData.loanRequest.purchasePrice);
  const marketValue = toNumber(formData.loanRequest.currentMarketValue);
  const rehabCost = toNumber(formData.loanRequest.rehabCost);
  const constructionCost = toNumber(formData.loanRequest.constructionCost);
  const afterRepairValue = toNumber(formData.loanRequest.afterRepairValue);
  const totalFlipCost = purchasePrice + rehabCost;
  const totalConstructionCost = purchasePrice + constructionCost;

  // -----------------------------------------------------------------
  // Equity / down payment derived values (live validation)
  // -----------------------------------------------------------------
  const downPaymentTotal = toNumber(formData.loanRequest.downPayment);
  const hasSellerFinancing = formData.loanRequest.sellerFinancing === "yes";
  const sellerFinancingTotal = hasSellerFinancing
    ? toNumber(formData.loanRequest.sellerNoteAmount)
    : 0;
  const loanAmountTotal = loanAmount;
  const purchasePriceTotal = purchasePrice;
  const hasPurchasePrice = purchasePriceTotal > 0;
  const equityGrandTotal =
    loanAmountTotal + downPaymentTotal + sellerFinancingTotal;
  // Small tolerance to avoid float-comparison false positives
  // (e.g. user-entered decimals like 100000.01 vs 100000.005).
  const equityMismatchError =
    hasPurchasePrice &&
    Math.abs(equityGrandTotal - purchasePriceTotal) >= 0.01;

  // -----------------------------------------------------------------
  // As-is value (depends on product family)
  // -----------------------------------------------------------------
  const asIsValue =
    isFixAndFlipProduct(selectedProduct) ||
    isBridgeProduct(selectedProduct) ||
    isRentalUnderwritingProduct(selectedProduct) ||
    isCreBase44Product(selectedProduct) ||
    isSbaBase44Product(selectedProduct) ||
    isConstruction14Product(selectedProduct)
      ? marketValue > 0
        ? marketValue
        : purchasePrice
      : marketValue;

  // -----------------------------------------------------------------
  // LTV / LTC / ARV
  // -----------------------------------------------------------------
  const ltvBaseValue = afterRepairValue > 0 ? afterRepairValue : asIsValue;
  const ltv =
    ltvBaseValue > 0 ? ((loanAmount / ltvBaseValue) * 100).toFixed(2) : "-";

  const ltc =
    isFixAndFlipProduct(selectedProduct) && totalFlipCost > 0
      ? ((loanAmount / totalFlipCost) * 100).toFixed(2)
      : isConstructionLoanProduct(selectedProduct) && totalConstructionCost > 0
        ? ((loanAmount / totalConstructionCost) * 100).toFixed(2)
        : purchasePrice > 0
          ? ((loanAmount / purchasePrice) * 100).toFixed(2)
          : "-";

  const arv =
    afterRepairValue > 0
      ? ((loanAmount / afterRepairValue) * 100).toFixed(2)
      : "-";

  // -----------------------------------------------------------------
  // Monthly payment / annual debt service
  // -----------------------------------------------------------------
  const interestRate = toNumber(formData.loanRequest.interestRate);
  const amortizationYears = toNumber(formData.loanRequest.amortization);
  const fallbackTermMonths = toNumber(formData.loanTermIncome.loanTerm);
  const termMonths =
    amortizationYears > 0 ? amortizationYears * 12 : fallbackTermMonths;
  const isInterestOnly = formData.loanRequest.rateType === "INTEREST_ONLY";

  // For interest-only loans the borrower pays only the accrued interest
  // each month (no principal amortization), so the term is irrelevant to
  // the monthly payment. The Loan Term field is hidden on step 0 when the
  // rate type is "Interest Only", and we fall back to a constant 12-month
  // term only for DSCR consistency if no amortization/term is provided.
  const monthlyPayment = isInterestOnly
    ? calculateInterestOnlyMonthlyPayment(loanAmount, interestRate)
    : calculateMonthlyPayment(loanAmount, interestRate, termMonths);
  const annualPrincipalAndInterest = monthlyPayment * 12;
  const annualPropertyTaxes = usesBase44Financials
    ? toNumber(formData.financials.annualPropertyTaxes)
    : toNumber(formData.loanTermIncome.annualTaxes);
  const annualInsurance = usesBase44Financials
    ? toNumber(formData.financials.annualInsurance)
    : toNumber(formData.loanTermIncome.insurancePremium);
  const totalAnnualDebtPayment =
    annualPrincipalAndInterest + annualPropertyTaxes + annualInsurance;

  // -----------------------------------------------------------------
  // DSCR
  // -----------------------------------------------------------------
  const crePermanentNoi = toNumber(formData.entity.ebitdaWithNoi);

  const residentialNoiForDscr = usesBase44Financials
    ? getResidentialNoiForDscr(formData.financials) || crePermanentNoi
    : toNumber(formData.loanTermIncome.noiActual) * 12;

  const residentialDebtService = usesBase44Financials
    ? getResidentialDebtServiceForDscr(
        formData.financials,
        totalAnnualDebtPayment,
      )
    : 0;

  const annualDebtService =
    residentialDebtService > 0
      ? residentialDebtService
      : totalAnnualDebtPayment;

  const dscr =
    annualDebtService > 0 && residentialNoiForDscr > 0
      ? (residentialNoiForDscr / annualDebtService).toFixed(2)
      : "-";

  const monthlyPaymentDisplay =
    monthlyPayment > 0
      ? "$" +
        monthlyPayment.toLocaleString("en-US", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })
      : "-";

  return {
    loanAmount,
    purchasePrice,
    marketValue,
    rehabCost,
    constructionCost,
    afterRepairValue,
    interestRate,
    amortizationYears,
    fallbackTermMonths,
    termMonths,
    monthlyPayment,
    borrowerAssets,
    borrowerLiabilities,
    netWorth,
    annualPrincipalAndInterest,
    annualPropertyTaxes,
    annualInsurance,
    totalAnnualDebtPayment,
    crePermanentNoi,
    residentialNoiForDscr,
    residentialDebtService,
    annualDebtService,
    downPaymentTotal,
    hasSellerFinancing,
    sellerFinancingTotal,
    loanAmountTotal,
    purchasePriceTotal,
    hasPurchasePrice,
    equityGrandTotal,
    equityMismatchError,
    totalFlipCost,
    totalConstructionCost,
    asIsValue,
    ltv,
    ltc,
    arv,
    dscr,
    monthlyPaymentDisplay,
  };
}

export interface CoBorrowerSummary {
  netWorth: number;
  ltv: number;
  ltc: number;
  dscr: number;
}

/**
 * Per-co-borrower net worth / LTV / LTC / DSCR. The form only computes
 * these at submit time (the UI shows just net worth per co-borrower
 * card). Splitting the loan evenly across co-borrowers matches the
 * previous inline implementation.
 */
export function getCoBorrowerSummaries(
  formData: FormDataType,
  metrics: LoanMetrics,
): CoBorrowerSummary[] {
  if (formData.coBorrowers.length === 0) return [];

  const coLoanAmount = metrics.loanAmount / formData.coBorrowers.length;
  const termMonths = metrics.termMonths;
  const interestRate = metrics.interestRate;

  return formData.coBorrowers.map((borrower) => {
    const coMarketValue = toNumber(borrower.currentMarketValue);
    const coPurchasePrice = toNumber(borrower.purchasePrice);
    const coInterest = borrower.interestRate
      ? toNumber(borrower.interestRate)
      : interestRate;

    const coNoi = toNumber(borrower.noi);
    const coAssets = toNumber(borrower.totalAssets);
    const coLiabilities = toNumber(borrower.totalLiabilities);

    const coNetWorth = coAssets - coLiabilities;

    const coLtv =
      coMarketValue > 0 ? (coLoanAmount / coMarketValue) * 100 : 0;

    const coLtc =
      coPurchasePrice > 0 ? (coLoanAmount / coPurchasePrice) * 100 : 0;

    const coAnnualDebt =
      calculateMonthlyPayment(coLoanAmount, coInterest, termMonths) * 12;

    const coDscr =
      coAnnualDebt > 0 && coNoi > 0 ? coNoi / coAnnualDebt : 0;

    return {
      netWorth: coNetWorth,
      ltv: coLtv,
      ltc: coLtc,
      dscr: coDscr,
    };
  });
}
