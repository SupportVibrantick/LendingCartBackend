// Derived metrics for the LoanApplication form. Pure functions only —
// no React state, no side effects. The main component calls
// `computeLoanMetrics` once per render and consumes the returned record
// for the stats banner, equity-mismatch banner, the
// `ResidentialFinancialsStep` annual debt service default, and the
// `submitApplication` payload.

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
  isConstructionLoanProduct,
  isFixAndFlipProduct,
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
 * the submission payload.
 */
export interface LoanMetrics {
  // Numeric inputs
  loanAmount: number;
  purchasePrice: number;
  marketValue: number;
  currentLoanBalance: number;
  rehabCost: number;
  constructionCost: number;
  afterRepairValue: number;
  interestRate: number;
  amortizationYears: number;
  fallbackTermMonths: number;
  termMonths: number;
  monthlyPayment: number;
  isInterestOnly: boolean;

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
  equityTargetTotal: number;
  equityGrandTotal: number;
  equityMismatchError: boolean;

  // Combined project costs
  totalFlipCost: number;
  totalConstructionCost: number;
  asIsValue: number;
  asIsEquity: number;
  valuationCapex: number;
  valuationProjectCost: number;

  // Formatted ratios (always `string` — `"-"` when undefined)
  ltv: string;
  ltc: string;
  arv: string;
  dscr: string;
  monthlyPaymentDisplay: string;
}

const formatPercentRatio = (numerator: number, denominator: number) =>
  denominator > 0 ? ((numerator / denominator) * 100).toFixed(2) : "-";

export function computeLoanMetrics(ctx: LoanMetricsContext): LoanMetrics {
  const { selectedProduct, usesBase44Financials, formData } = ctx;

  const borrowerAssets = usesBase44Financials
    ? sumBorrowerAssets(formData.borrower.assets)
    : toNumber(formData.loanRequest.totalAssets || "0");
  const borrowerLiabilities = usesBase44Financials
    ? sumBorrowerLiabilities(formData.borrower.liabilities)
    : toNumber(formData.loanRequest.totalLiabilities || "0");
  const netWorth = borrowerAssets - borrowerLiabilities;

  const loanAmount = toNumber(formData.loanRequest.amount);
  const purchasePrice = toNumber(formData.loanRequest.purchasePrice);
  const marketValue = toNumber(formData.loanRequest.currentMarketValue);
  const currentLoanBalance = toNumber(formData.loanRequest.currentLoanBalance);
  const rehabCost = toNumber(formData.loanRequest.rehabCost);
  const constructionCost = toNumber(formData.loanRequest.constructionCost);
  const afterRepairValue = toNumber(formData.loanRequest.afterRepairValue);

  // Purchase-deal project cost (price + capex). Refinance uses as-is + capex below.
  const totalFlipCost = purchasePrice + rehabCost;
  const totalConstructionCost = purchasePrice + constructionCost;

  const downPaymentTotal = toNumber(formData.loanRequest.downPayment);
  const hasSellerFinancing = formData.loanRequest.sellerFinancing === "yes";
  const sellerFinancingTotal = hasSellerFinancing
    ? toNumber(formData.loanRequest.sellerNoteAmount)
    : 0;
  const loanAmountTotal = loanAmount;
  const purchasePriceTotal = purchasePrice;
  const hasPurchasePrice = purchasePriceTotal > 0;
  // Funding stack must cover total project cost for construction / F&F:
  // Purchase + Construction/Rehab = Loan + Down (+ Seller Note).
  // Other purchase products still balance against purchase price only.
  const equityTargetTotal = isConstructionLoanProduct(selectedProduct)
    ? purchasePrice + constructionCost
    : isFixAndFlipProduct(selectedProduct)
      ? purchasePrice + rehabCost
      : purchasePrice;
  const equityGrandTotal =
    loanAmountTotal + downPaymentTotal + sellerFinancingTotal;
  // Small tolerance to avoid float-comparison false positives
  // (e.g. user-entered decimals like 100000.01 vs 100000.005).
  const equityMismatchError =
    hasPurchasePrice &&
    Math.abs(equityGrandTotal - equityTargetTotal) >= 0.01;

  // As-is = current market when entered, otherwise purchase price.
  const asIsValue = marketValue > 0 ? marketValue : purchasePrice;
  const asIsEquity = Math.max(marketValue - currentLoanBalance, 0);
  const valuationCapex = isConstructionLoanProduct(selectedProduct)
    ? constructionCost
    : rehabCost;
  const valuationProjectCost = marketValue + valuationCapex;

  // LTV is always loan / as-is. ARV% is a separate metric (loan / ARV).
  const ltv = formatPercentRatio(loanAmount, asIsValue);

  // LTC = loan / total project cost.
  // Purchase: purchase price + capex. Refinance (no purchase price): as-is + capex.
  let ltcBase = 0;
  if (isFixAndFlipProduct(selectedProduct)) {
    ltcBase = (purchasePrice > 0 ? purchasePrice : asIsValue) + rehabCost;
  } else if (isConstructionLoanProduct(selectedProduct)) {
    ltcBase =
      (purchasePrice > 0 ? purchasePrice : asIsValue) + constructionCost;
  } else if (purchasePrice > 0) {
    ltcBase = purchasePrice;
  }
  const ltc = formatPercentRatio(loanAmount, ltcBase);

  const arv = formatPercentRatio(loanAmount, afterRepairValue);

  const interestRate = toNumber(formData.loanRequest.interestRate);
  const amortizationYears = toNumber(formData.loanRequest.amortization);
  const fallbackTermMonths = toNumber(formData.loanTermIncome.loanTerm);
  const termMonths =
    amortizationYears > 0 ? amortizationYears * 12 : fallbackTermMonths;
  const isInterestOnly = formData.loanRequest.rateType === "INTEREST_ONLY";

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

  const crePermanentNoi = toNumber(formData.entity.ebitdaWithNoi);

  // NOI Actual is labeled annual ("/ Year"). Do not multiply by 12.
  const residentialNoiForDscr = usesBase44Financials
    ? getResidentialNoiForDscr(formData.financials) || crePermanentNoi
    : toNumber(formData.loanTermIncome.noiActual);

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
    currentLoanBalance,
    rehabCost,
    constructionCost,
    afterRepairValue,
    interestRate,
    amortizationYears,
    fallbackTermMonths,
    termMonths,
    monthlyPayment,
    isInterestOnly,
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
    equityTargetTotal,
    equityGrandTotal,
    equityMismatchError,
    totalFlipCost,
    totalConstructionCost,
    asIsValue,
    asIsEquity,
    valuationCapex,
    valuationProjectCost,
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
 * Per-co-borrower net worth / LTV / LTC / DSCR. The loan is split across
 * the primary borrower plus every co-borrower (joint obligation).
 */
export function getCoBorrowerSummaries(
  formData: FormDataType,
  metrics: LoanMetrics,
): CoBorrowerSummary[] {
  if (formData.coBorrowers.length === 0) return [];

  const borrowerCount = formData.coBorrowers.length + 1;
  const coLoanAmount = metrics.loanAmount / borrowerCount;
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

    const coMonthlyPayment = metrics.isInterestOnly
      ? calculateInterestOnlyMonthlyPayment(coLoanAmount, coInterest)
      : calculateMonthlyPayment(coLoanAmount, coInterest, termMonths);
    const coAnnualDebt = coMonthlyPayment * 12;

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
