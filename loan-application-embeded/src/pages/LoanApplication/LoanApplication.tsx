import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router";
import { Building2, HomeIcon, Landmark, Settings } from "lucide-react";

import {
  createSbaEntityDefaults,
  isSba7aAcquisitionProduct,
  isSbaRealEstateCollateralProduct,
  isSbaBase44Product,
  SBA_BUSINESS_INDUSTRY_TYPES,
} from "../../lib/sba7aAcquisition";
import {
  isAblBase44Product,
  isEquipmentFinanceProduct,
  showAblBase44PurchasePrice,
  showEquipmentFinanceMarketValue,
} from "../../lib/ablBase44";
import { isBase44BusinessCollateralProduct } from "../../lib/base44BusinessCollateral";
import {
  revokePendingDocumentPreview,
  type PendingApplicationDocument,
} from "../../lib/applicationDocumentTypes";
import { uploadPendingApplicationDocuments, uploadPublicPendingDocuments } from "../../lib/uploadApplicationDocuments";
import {
  createResidentialFinancialsDefaults,
  appendResidentialFinancialsSubmission,
  getResidentialDebtServiceForDscr,
  getResidentialNoiForDscr,
  type ResidentialFinancials,
} from "../../lib/residentialFinancials";
import {
  createEmptyRealEstateProperty,
  createResidentialBorrowerDefaults,
  appendResidentialBorrowerSubmission,
  countUnansweredDeclarations,
  sumBorrowerAssets,
  sumBorrowerLiabilities,
  type RealEstateOwnedEntry,
  type ResidentialBorrowerFields,
} from "../../lib/residentialBorrower";
import { buildResidentialReviewSections } from "../../lib/residentialReviewHelpers";
import { resolveCanonicalLoanProductCode } from "../../lib/canonicalLoanProducts";
import LoanDateField from "../../components/form/LoanDateField";
import LoanApplicationStepper from "../../components/loanApplication/LoanApplicationStepper";
import ResidentialBorrowerPanel from "../../components/loanApplication/ResidentialBorrowerPanel";
import ResidentialFinancialsStep from "../../components/loanApplication/ResidentialFinancialsStep";
import ResidentialDocumentsStep from "../../components/loanApplication/ResidentialDocumentsStep";
import ResidentialReviewStep from "../../components/loanApplication/ResidentialReviewStep";
import Sba7aEntityFields from "../../components/loanApplication/Sba7aEntityFields";
import AblEntityFields from "../../components/loanApplication/AblEntityFields";
import AddCollateralChips from "../../components/loanApplication/AddCollateralChips";
import SaleDetailsCard from "../../components/loanApplication/SaleDetailsCard";
import { IoArrowBack } from "react-icons/io5";
import { IoIosArrowBack } from "react-icons/io";
import { MdDeleteForever } from "react-icons/md";

import {
  ALL_LOAN_PURPOSES,
  CATEGORY_LOAN_TYPES,
  CONSTRUCTION_LOAN_TYPES,
  CRE_RESIDENTIAL_LIKE_LOAN_TYPES,
  ENTITY_TYPE_OPTIONS,
  LOAN_PURPOSE_MAP,
  LOAN_SUB_PURPOSE_MAP,
  LOAN_TOP_PURPOSE_MAP,
  OPTIONAL_LOAN_REQUEST_KEYS,
  ORIGINAL_PURCHASE_DATE_WITH_AMORTIZATION_PURPOSES,
  PRODUCT_LABELS,
  PROPERTY_TYPE_MAP,
  PURCHASE_DATE_WITH_AMORTIZATION_LOAN_TYPES,
  PURCHASE_DATE_WITH_AMORTIZATION_PURPOSES,
  RENTAL_UNDERWRITING_LOAN_TYPES,
  RESIDENTIAL_1_4_PROPERTY_TYPES,
  RESIDENTIAL_MARKET_VALUE_PURPOSES,
  RESIDENTIAL_PURCHASE_PRICE_PURPOSES,
  US_STATES,
} from "./constants";
import {
  calculateMonthlyPayment,
  formatCurrency,
  formatSSN,
  formatUSPhone,
  toNumber,
} from "./formatters";
import {
  getAblCollateralTypeOptions,
  getSbaCollateralTypeLabel,
  getSbaCollateralTypeOptions,
  isAblCollateralProduct,
  isConstructionPurchase,
  isProductAllowedInCategory,
  isSbaUsdaCollateralProduct,
  resolveCategoryLoanProducts,
  showConstructionCostLable,
  showEquityDownPaymentBlock,
  showExitStrategy,
  showPrivateDetails,
  showValuationCostEquity,
  showValuationEquityBlock,
} from "./productRules";
import { validateFieldValue, CO_BROKER_BORROWER_INFO_STEP } from "./validation";
import { getRuleForKey, validateValue } from "./liveValidation";
import { withBorrowerNameFields } from "./submission";
import {
  appendReferringBrokerSubmission,
  createEmptyReferringBroker,
  createEmptyReferringBrokerFormState,
  loadReferringBrokerDraft,
  saveReferringBrokerDraft,
  validateReferringBrokerStep,
  type ReferringBrokerFormState,
  type WorkingWithMortgageBrokerAnswer,
} from "../../lib/referringBroker";

export interface Borrower extends ResidentialBorrowerFields {
  name: string;
  entityName: string;
  phone: string;
  email: string;
  employer: string;
  dob: string;
  ssn: string;
  creditScore: string;
  address: string;
  city: string;
  state: string;
  mailingAddress: string;
}

export interface CoBorrower extends Borrower {
  id: number;

  // Financial
  currentMarketValue: string;
  purchasePrice: string;
  interestRate: string;
  noi: string;
  totalAssets: string;
  totalLiabilities: string;
}

export interface FormDataType {
  borrower: Borrower;
  coBorrowers: CoBorrower[];
  loanRequest: {
    purpose: string;
    subPurpose: string;
    amount: string;
    interestRate: string;
    sellerFinancing: string;
    sellerNoteAmount: string;
    estimatedClosingDate: string;
    rateType: string;
    brokerPoints: string;
    amortization: string;
    currentMarketValue: string;
    currentLoanBalance: string;
    purchasePrice: string;
    purchaseDate: string;
    totalAssets: string;
    totalLiabilities: string;
    afterRepairValue: string;
    rehabCost: string;
    constructionCost: string;

    propertyType: string;
    subPropertyType: string;
    collateralType: string;
    additionalCollateral: string[];
    privateSale: boolean;
    vendorName: string;
    vendorPhone: string;
    recourse: string;
    businessAddress: string;
    city: string;
    state: string;
    zip: string;
    numberOfUnits: string;
    downPayment: string;
    useOfFunds: string;
    exitStrategy: string;
  };
  loanTermIncome: {
    loanTerm: string;
    monthlyRent: string;
    grossRevenueActual: string;
    grossRevenueProforma: string;
    noiActual: string;
    noiProforma: string;
    annualTaxes: string;
    floodZone: string;
    insurancePremium: string;
    hoaDues: string;
  };
  entity: {
    legalName: string;
    entityType: string;
    dba: string;
    formationDate: string;
    yearsInBusiness: string;
    ebitdaWithNoi: string;
    naicsCode: string;
    goodwillAmount: string;
    inventoryIncluded: boolean;
    inventoryValue: string;
    equipmentIncluded: boolean;
    equipmentValue: string;
  };
  financials: ResidentialFinancials;
  workingWithMortgageBroker?: "" | "yes" | "no";
  referringBroker?: {
    email: string;
    firstName: string;
    lastName: string;
    companyName: string;
    phone: string;
  };
}

export type LoanCategory =
  | "RESIDENTIAL_1_4"
  | "CRE_MULTIFAMILY"
  | "SBA_USDA"
  | "ABL"
  | "";

/* ================= HELPERS ================= */
const API_BASE =
  (import.meta as any).env?.VITE_API_BASE ||
  "https://api-lendingcart.vibrantick.org";

const BRIDGE_LOAN_TYPES = new Set(["BRIDGE_LOAN", "BRIDGE_LOAN_1_TO_4_UNITS"]);
const BRIDGE_PURCHASE_PURPOSE = "Purchase/Acquisition";
const BRIDGE_ORIGINAL_PURCHASE_DATE_PURPOSES = new Set([
  "Refinance (Rate & Term)",
  "Cash Out Refinance",
]);
const BRIDGE_CONSTRUCTION_COMPLETION_PURPOSE = "Construction Completion";

const FIX_AND_FLIP_LOAN_TYPES = new Set(["FIX_AND_FLIP_LOAN_1_TO_4_UNITS"]);
const FIX_AND_FLIP_PURCHASE_REHAB_PURPOSE = "Purchase & Rehab";
const FIX_AND_FLIP_REFINANCE_REHAB_PURPOSE = "Refinance & Rehab";

const MEZZANINE_LOAN_TYPES = new Set(["MEZZANINE_FINANCE"]);
const MEZZANINE_ACQUISITION_BRIDGE_PURPOSE = "Acquisition Bridge";

const isBridgePurchaseAcquisition = (product: string, purpose: string) =>
  BRIDGE_LOAN_TYPES.has(product) && purpose === BRIDGE_PURCHASE_PURPOSE;

const isBridgeOriginalPurchaseDate = (product: string, purpose: string) =>
  BRIDGE_LOAN_TYPES.has(product) &&
  BRIDGE_ORIGINAL_PURCHASE_DATE_PURPOSES.has(purpose);

const isBridgeConstructionCompletion = (product: string, purpose: string) =>
  BRIDGE_LOAN_TYPES.has(product) &&
  purpose === BRIDGE_CONSTRUCTION_COMPLETION_PURPOSE;

const isConstructionLoanType = (product: string) =>
  CONSTRUCTION_LOAN_TYPES.has(product);

const isMezzanineLoanType = (product: string) =>
  MEZZANINE_LOAN_TYPES.has(product);

const isMezzanineAcquisitionBridge = (product: string, purpose: string) =>
  isMezzanineLoanType(product) &&
  purpose === MEZZANINE_ACQUISITION_BRIDGE_PURPOSE;

const SBA_7A_ACQUISITION_PURCHASE_DATE_PURPOSES = new Set([
  "Purchase/Acquisition",
  "Franchise Purchase",
]);

const isSba7aAcquisitionPurchaseDate = (product: string, purpose: string) =>
  product === "SBA_7A_BUSINESS_ACQUISITION" &&
  SBA_7A_ACQUISITION_PURCHASE_DATE_PURPOSES.has(purpose);

const isSba7aAcquisitionNonPurchase = (product: string, purpose: string) =>
  product === "SBA_7A_BUSINESS_ACQUISITION" &&
  Boolean(purpose?.trim()) &&
  !SBA_7A_ACQUISITION_PURCHASE_DATE_PURPOSES.has(purpose);

const SBA_7A_WORKING_CAPITAL_PURCHASE_DATE_PURPOSES = new Set([
  "Inventory Purchase",
]);

const SBA_7A_WORKING_CAPITAL_ORIGINAL_PURCHASE_DATE_PURPOSES = new Set([
  "Debt Consolidation",
]);

const isSba7aWorkingCapitalOriginalPurchaseDate = (
  product: string,
  purpose: string,
) =>
  product === "SBA_7A_WORKING_CAPITAL" &&
  SBA_7A_WORKING_CAPITAL_ORIGINAL_PURCHASE_DATE_PURPOSES.has(purpose);

const isSba7aWorkingCapitalLoanRequestDate = (
  product: string,
  purpose: string,
) =>
  product === "SBA_7A_WORKING_CAPITAL" &&
  (SBA_7A_WORKING_CAPITAL_PURCHASE_DATE_PURPOSES.has(purpose) ||
    SBA_7A_WORKING_CAPITAL_ORIGINAL_PURCHASE_DATE_PURPOSES.has(purpose));

const isSba7aWorkingCapitalNonPurchase = (product: string, purpose: string) =>
  product === "SBA_7A_WORKING_CAPITAL" &&
  Boolean(purpose?.trim()) &&
  !isSba7aWorkingCapitalLoanRequestDate(product, purpose);

const SBA_7A_EQUIPMENT_ORIGINAL_PURCHASE_DATE_PURPOSES = new Set([
  "Refinance Existing Equipment",
]);

const isSba7aEquipmentOriginalPurchaseDate = (
  product: string,
  purpose: string,
) =>
  product === "SBA_7A_EQUIPMENT_PURCHASE" &&
  SBA_7A_EQUIPMENT_ORIGINAL_PURCHASE_DATE_PURPOSES.has(purpose);

const isSba7aEquipmentLoanRequestDate = (product: string, purpose: string) =>
  product === "SBA_7A_EQUIPMENT_PURCHASE" &&
  SBA_7A_EQUIPMENT_ORIGINAL_PURCHASE_DATE_PURPOSES.has(purpose);

const isSba7aEquipmentNonPurchase = (product: string, purpose: string) =>
  product === "SBA_7A_EQUIPMENT_PURCHASE" &&
  Boolean(purpose?.trim()) &&
  !isSba7aEquipmentLoanRequestDate(product, purpose);

const EQUIPMENT_FINANCE_PURCHASE_DATE_PURPOSES = new Set([
  "New Equipment Purchase",
  "Used Equipment Purchase",
]);

const EQUIPMENT_FINANCE_ORIGINAL_PURCHASE_DATE_PURPOSES = new Set([
  "Refinance/Consolidation",
]);

const isEquipmentFinanceOriginalPurchaseDate = (
  product: string,
  purpose: string,
) =>
  product === "EQUIPMENT_FINANCE" &&
  EQUIPMENT_FINANCE_ORIGINAL_PURCHASE_DATE_PURPOSES.has(purpose);

const isEquipmentFinanceLoanRequestDate = (product: string, purpose: string) =>
  product === "EQUIPMENT_FINANCE" &&
  (EQUIPMENT_FINANCE_PURCHASE_DATE_PURPOSES.has(purpose) ||
    EQUIPMENT_FINANCE_ORIGINAL_PURCHASE_DATE_PURPOSES.has(purpose));

const isEquipmentFinanceNonPurchase = (product: string, purpose: string) =>
  product === "EQUIPMENT_FINANCE" &&
  Boolean(purpose?.trim()) &&
  !isEquipmentFinanceLoanRequestDate(product, purpose);

const PURCHASE_ORDER_FINANCE_PURCHASE_DATE_PURPOSES = new Set<string>([]);
const PURCHASE_ORDER_FINANCE_ORIGINAL_PURCHASE_DATE_PURPOSES = new Set<string>(
  [],
);

const isPurchaseOrderFinanceLoanRequestDate = (
  product: string,
  purpose: string,
) =>
  product === "PURCHASE_ORDER_FINANCE" &&
  (PURCHASE_ORDER_FINANCE_PURCHASE_DATE_PURPOSES.has(purpose) ||
    PURCHASE_ORDER_FINANCE_ORIGINAL_PURCHASE_DATE_PURPOSES.has(purpose));

const isPurchaseOrderFinanceNonPurchase = (product: string, purpose: string) =>
  product === "PURCHASE_ORDER_FINANCE" &&
  Boolean(purpose?.trim()) &&
  !isPurchaseOrderFinanceLoanRequestDate(product, purpose);

const ACCOUNTS_RECEIVABLE_LOAN_TYPES = new Set([
  "ACCOUNTS_RECEIVABLE_FINANCE",
  "ACCOUNTS_RECEIVABLE",
]);

const ACCOUNTS_RECEIVABLE_PURCHASE_DATE_PURPOSES = new Set<string>([]);
const ACCOUNTS_RECEIVABLE_ORIGINAL_PURCHASE_DATE_PURPOSES = new Set<string>([]);

const isAccountsReceivableLoanRequestDate = (
  product: string,
  purpose: string,
) =>
  ACCOUNTS_RECEIVABLE_LOAN_TYPES.has(product) &&
  (ACCOUNTS_RECEIVABLE_PURCHASE_DATE_PURPOSES.has(purpose) ||
    ACCOUNTS_RECEIVABLE_ORIGINAL_PURCHASE_DATE_PURPOSES.has(purpose));

const isAccountsReceivableNonPurchase = (product: string, purpose: string) =>
  ACCOUNTS_RECEIVABLE_LOAN_TYPES.has(product) &&
  Boolean(purpose?.trim()) &&
  !isAccountsReceivableLoanRequestDate(product, purpose);

const ACCOUNTS_PAYABLE_PURCHASE_DATE_PURPOSES = new Set<string>([]);
const ACCOUNTS_PAYABLE_ORIGINAL_PURCHASE_DATE_PURPOSES = new Set<string>([]);

const isAccountsPayableLoanRequestDate = (product: string, purpose: string) =>
  product === "ACCOUNTS_PAYABLE_FINANCE" &&
  (ACCOUNTS_PAYABLE_PURCHASE_DATE_PURPOSES.has(purpose) ||
    ACCOUNTS_PAYABLE_ORIGINAL_PURCHASE_DATE_PURPOSES.has(purpose));

const isAccountsPayableNonPurchase = (product: string, purpose: string) =>
  product === "ACCOUNTS_PAYABLE_FINANCE" &&
  Boolean(purpose?.trim()) &&
  !isAccountsPayableLoanRequestDate(product, purpose);

const hidesLoanRequestAmortization = (product: string, purpose: string) =>
  isBridgeConstructionCompletion(product, purpose) ||
  isConstructionLoanType(product) ||
  (isMezzanineLoanType(product) &&
    !isMezzanineAcquisitionBridge(product, purpose)) ||
  isSba7aAcquisitionNonPurchase(product, purpose) ||
  isSba7aWorkingCapitalNonPurchase(product, purpose) ||
  isSba7aEquipmentNonPurchase(product, purpose) ||
  isEquipmentFinanceNonPurchase(product, purpose) ||
  isPurchaseOrderFinanceNonPurchase(product, purpose) ||
  isAccountsReceivableNonPurchase(product, purpose) ||
  isAccountsPayableNonPurchase(product, purpose);

const isFixAndFlipPurchaseRehab = (product: string, purpose: string) =>
  FIX_AND_FLIP_LOAN_TYPES.has(product) &&
  purpose === FIX_AND_FLIP_PURCHASE_REHAB_PURPOSE;

const isFixAndFlipRefinanceRehab = (product: string, purpose: string) =>
  FIX_AND_FLIP_LOAN_TYPES.has(product) &&
  purpose === FIX_AND_FLIP_REFINANCE_REHAB_PURPOSE;

const isCrePermanentRecapitalization = (product: string, purpose: string) =>
  product === "CRE_PERMANENT_LOAN" && purpose === "Recapitalization";

const AGENCY_MULTIFAMILY_NO_PURCHASE_DATE_PURPOSES = new Set([
  "Affordable Housing",
  "Supplement Loan",
]);

const isAgencyMultifamilyNoPurchaseDate = (product: string, purpose: string) =>
  product === "AGENCY_LOAN_MULTIFAMILY" &&
  AGENCY_MULTIFAMILY_NO_PURCHASE_DATE_PURPOSES.has(purpose);

const isPurchaseDateWithAmortization = (product: string, purpose: string) =>
  PURCHASE_DATE_WITH_AMORTIZATION_LOAN_TYPES.has(product) &&
  (PURCHASE_DATE_WITH_AMORTIZATION_PURPOSES.has(purpose) ||
    ORIGINAL_PURCHASE_DATE_WITH_AMORTIZATION_PURPOSES.has(purpose));

const isOriginalPurchaseDateWithAmortization = (
  product: string,
  purpose: string,
) =>
  PURCHASE_DATE_WITH_AMORTIZATION_LOAN_TYPES.has(product) &&
  ORIGINAL_PURCHASE_DATE_WITH_AMORTIZATION_PURPOSES.has(purpose);

const isLoanRequestOriginalPurchaseDate = (product: string, purpose: string) =>
  isBridgeOriginalPurchaseDate(product, purpose) ||
  isFixAndFlipRefinanceRehab(product, purpose) ||
  isOriginalPurchaseDateWithAmortization(product, purpose) ||
  isSba7aWorkingCapitalOriginalPurchaseDate(product, purpose) ||
  isSba7aEquipmentOriginalPurchaseDate(product, purpose) ||
  isEquipmentFinanceOriginalPurchaseDate(product, purpose);

const isBridgeLoanRequestDateField = (product: string, purpose: string) =>
  isBridgePurchaseAcquisition(product, purpose) ||
  isBridgeOriginalPurchaseDate(product, purpose);

const isLoanRequestPurchaseDateReplacesAmortization = (
  product: string,
  purpose: string,
) =>
  isBridgeLoanRequestDateField(product, purpose) ||
  isFixAndFlipPurchaseRehab(product, purpose) ||
  isFixAndFlipRefinanceRehab(product, purpose) ||
  isMezzanineAcquisitionBridge(product, purpose) ||
  isSba7aAcquisitionPurchaseDate(product, purpose) ||
  isSba7aWorkingCapitalLoanRequestDate(product, purpose) ||
  isSba7aEquipmentLoanRequestDate(product, purpose) ||
  isEquipmentFinanceLoanRequestDate(product, purpose);

const isLoanRequestPurchaseDateField = (product: string, purpose: string) =>
  isLoanRequestPurchaseDateReplacesAmortization(product, purpose) ||
  isPurchaseDateWithAmortization(product, purpose);

const shouldHidePropertyPurchaseDate = (product: string, purpose: string) =>
  isLoanRequestPurchaseDateField(product, purpose) ||
  hidesLoanRequestAmortization(product, purpose) ||
  isCrePermanentRecapitalization(product, purpose) ||
  isAgencyMultifamilyNoPurchaseDate(product, purpose);

const getLoanRequestPurchaseDateLabel = (product: string, purpose: string) =>
  isLoanRequestOriginalPurchaseDate(product, purpose)
    ? "Original Purchase Date"
    : "Purchase Date";

const RENTAL_PORTFOLIO_LOAN_TYPES = new Set(["RENTAL_PORTFOLIO"]);

const isResidential14Category = (category: LoanCategory) =>
  category === "RESIDENTIAL_1_4";

const isCreResidentialLikeCategoryProduct = (
  category: LoanCategory,
  product: string,
) =>
  category === "CRE_MULTIFAMILY" &&
  CRE_RESIDENTIAL_LIKE_LOAN_TYPES.has(product);

const isBridgeProduct = (product: string) => BRIDGE_LOAN_TYPES.has(product);

const CRE_PERMANENT_LOAN_TYPE = "CRE_PERMANENT_LOAN";
const AGENCY_MULTIFAMILY_LOAN_TYPE = "AGENCY_LOAN_MULTIFAMILY";
const CMBS_LOAN_TYPE = "CMBS";
const MEZZANINE_FINANCE_LOAN_TYPE = "MEZZANINE_FINANCE";

const CRE_BASE44_LOAN_TYPES = new Set([
  CRE_PERMANENT_LOAN_TYPE,
  AGENCY_MULTIFAMILY_LOAN_TYPE,
  CMBS_LOAN_TYPE,
  MEZZANINE_FINANCE_LOAN_TYPE,
]);

const CRE_BASE44_EBITDA_LOAN_TYPES = new Set([
  CRE_PERMANENT_LOAN_TYPE,
  AGENCY_MULTIFAMILY_LOAN_TYPE,
  CMBS_LOAN_TYPE,
]);

const isCrePermanentProduct = (product: string) =>
  product === CRE_PERMANENT_LOAN_TYPE;

const isAgencyMultifamilyProduct = (product: string) =>
  product === AGENCY_MULTIFAMILY_LOAN_TYPE;

const isCreBase44Product = (product: string) =>
  CRE_BASE44_LOAN_TYPES.has(product);

const showCreBase44EntityEbitda = (product: string) =>
  CRE_BASE44_EBITDA_LOAN_TYPES.has(product);

const isConstructionLoanProduct = (product: string) =>
  product === "CONSTRUCTION_LOAN_1_TO_4_UNITS" ||
  product === "CONSTRUCTION_LOAN";

const showResidentialPropertyPurchasePrice = (
  product: string,
  purpose: string,
) =>
  RESIDENTIAL_PURCHASE_PRICE_PURPOSES.has(purpose) ||
  isBridgePurchaseAcquisition(product, purpose) ||
  isFixAndFlipPurchaseRehab(product, purpose) ||
  isConstructionLoanProduct(product) ||
  isMezzanineLoanType(product) ||
  isSba7aAcquisitionProduct(product) ||
  showAblBase44PurchasePrice(product, purpose) ||
  isSbaRealEstateCollateralProduct(product) ||
  (isCreBase44Product(product) && purpose === "Purchase/Acquisition");

const showResidentialPropertyConstructionCost = (product: string) =>
  isConstructionLoanProduct(product);

const showResidentialPropertyMarketValue = (product: string, purpose: string) =>
  RESIDENTIAL_MARKET_VALUE_PURPOSES.has(purpose) ||
  isBridgeOriginalPurchaseDate(product, purpose) ||
  isBridgeConstructionCompletion(product, purpose) ||
  isFixAndFlipRefinanceRehab(product, purpose) ||
  (isCrePermanentProduct(product) && purpose === "Recapitalization") ||
  (isAgencyMultifamilyProduct(product) &&
    (purpose === "Affordable Housing" || purpose === "Supplement Loan")) ||
  (isSbaRealEstateCollateralProduct(product) &&
    (purpose === "Refinance" ||
      purpose === "Refinance & Rehab" ||
      purpose === "Refinance (504 Debt)" ||
      purpose === "Debt Refinancing")) ||
  (isEquipmentFinanceProduct(product) &&
    showEquipmentFinanceMarketValue(purpose));

const showResidentialPropertyArv = (product: string) =>
  FIX_AND_FLIP_LOAN_TYPES.has(product) || isConstructionLoanProduct(product);

const showResidentialPropertyRehabCost = (product: string) =>
  FIX_AND_FLIP_LOAN_TYPES.has(product);

const isFixAndFlipProduct = (product: string) =>
  FIX_AND_FLIP_LOAN_TYPES.has(product);

const isRentalPortfolioProduct = (product: string) =>
  RENTAL_PORTFOLIO_LOAN_TYPES.has(product);

const isRentalUnderwritingProduct = (product: string) =>
  RENTAL_UNDERWRITING_LOAN_TYPES.has(product);

const isConstruction14Product = (product: string) =>
  isConstructionLoanProduct(product);

export type LoanApplicationMode = "create" | "update";

export type LoanApplicationPortal = "broker" | "loan_officer" | "coBroker";

export type LoanApplicationDocumentPaths = {
  requestDocuments: (loanApplicationId: string) => string;
  listDocuments: (submissionId: string) => string;
  uploadDocument: (submissionId: string, requirementId: string) => string;
};

function getPortalConfig(portal: LoanApplicationPortal, apiBase: string) {
  if (portal === "loan_officer") {
    return {
      tokenKey: "loan_officer_token",
      submitUrl: `${apiBase}/loanofficer/applications/submit`,
      editUrl: (applicationId: string) =>
        `${apiBase}/loanofficer/applications/${applicationId}/edit`,
      loanProductsUrl: `${apiBase}/common/loan-products/loan-product-code`,
      loanProductsAuth: false,
      successPath: "/loan-officer/loan-pipeline",
      backLabel: "Back to Loan Pipeline",
      documentPaths: {
        requestDocuments: (loanApplicationId: string) =>
          `${apiBase}/broker/loan-pipeline/${loanApplicationId}/request-documents`,
        listDocuments: (submissionId: string) =>
          `${apiBase}/broker/loan-pipeline/submissions/${submissionId}/documents?limit=100&documentCategory=upload`,
        uploadDocument: (submissionId: string, requirementId: string) =>
          `${apiBase}/broker/loan-pipeline/submissions/${submissionId}/documents/${requirementId}/upload`,
      } satisfies LoanApplicationDocumentPaths,
    };
  }

  if (portal === "coBroker") {
    return {
      tokenKey: "sub_broker_token",
      submitUrl: `${apiBase}/subbroker/applications/submit`,
      editUrl: (applicationId: string) =>
        `${apiBase}/subbroker/applications/${applicationId}/edit`,
      loanProductsUrl: `${apiBase}/common/loan-products/loan-product-code`,
      loanProductsAuth: false,
      successPath: "/sub-broker/loan-pipeline",
      backLabel: "Back to Loan Pipeline",
      documentPaths: {
        requestDocuments: (loanApplicationId: string) =>
          `${apiBase}/subbroker/documents/${loanApplicationId}/request-documents`,
        listDocuments: (submissionId: string) =>
          `${apiBase}/subbroker/documents/submissions/${submissionId}/documents?limit=100&documentCategory=upload`,
        uploadDocument: (submissionId: string, requirementId: string) =>
          `${apiBase}/subbroker/documents/submissions/${submissionId}/documents/${requirementId}/upload`,
      } satisfies LoanApplicationDocumentPaths,
    };
  }

  return {
    tokenKey: "broker_token",
    submitUrl: `${apiBase}/broker/applications/submit`,
    editUrl: (applicationId: string) =>
      `${apiBase}/broker/applications/${applicationId}/edit`,
    loanProductsUrl: `${apiBase}/common/loan-products/loan-product-code`,
    loanProductsAuth: false,
    successPath: "/submit-applications",
    backLabel: "Back to Submit Applications",
    documentPaths: {
      requestDocuments: (loanApplicationId: string) =>
        `${apiBase}/broker/loan-pipeline/${loanApplicationId}/request-documents`,
      listDocuments: (submissionId: string) =>
        `${apiBase}/broker/loan-pipeline/submissions/${submissionId}/documents?limit=100&documentCategory=upload`,
      uploadDocument: (submissionId: string, requirementId: string) =>
        `${apiBase}/broker/loan-pipeline/submissions/${submissionId}/documents/${requirementId}/upload`,
    } satisfies LoanApplicationDocumentPaths,
  };
}

export type LoanApplicationProps = {
  mode?: LoanApplicationMode;
  portal?: LoanApplicationPortal;
  embedded?: boolean;
  publicEmbed?: boolean;
  editApplicationId?: string;
  initialFormData?: FormDataType;
  initialSelectedProduct?: string;
  initialSelectedCategory?: LoanCategory;
  initialDynamicFormData?: Record<string, any>;
  initialCreditAuthorizationConsent?: boolean;
  onUpdateSuccess?: (submissionId?: string) => void;
  onPublicSubmitSuccess?: (submissionId?: string) => void;
  onPublicSubmitError?: (message: string) => void;
  reviewCaptchaSlot?: ReactNode;
  recaptchaToken?: string | null;
  /** Embedded-only: broker org id (used to attach submissions to an org). */
  brokerOrgId?: string | null;
  /** Embedded-only: ref token for the public share link. */
  publicLinkRef?: string | null;
  /** Embedded-only: portal of the originating broker/LO share. */
  publicSourcePortal?: LoanApplicationPortal | null;
  /** Embedded-only: whether to surface the "are you a broker?" step. */
  showCoBrokerBorrowerInformationTab?: boolean;
};

async function fetchLoanProductCatalog(
  portalConfig: ReturnType<typeof getPortalConfig>,
) {
  const headers: Record<string, string> = {};

  if (portalConfig.loanProductsAuth) {
    const token = sessionStorage.getItem(portalConfig.tokenKey);
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(portalConfig.loanProductsUrl, { headers });
  const result = await response.json();

  if (!response.ok || result.success === false) {
    throw new Error(result.message || "Failed to load loan products");
  }

  const products = (result.data || []).map((product: any) => ({
    productId: product.id,
    loanProductCode: product.code,
    name: product.name,
    sections: [],
    unsectionedFields: [],
  }));

  return { products };
}

const LoanApplication = ({
  mode = "create",
  portal = "broker",
  embedded = false,
  publicEmbed = false,
  editApplicationId,
  initialFormData,
  initialSelectedProduct = "",
  initialSelectedCategory = "",
  initialDynamicFormData,
  initialCreditAuthorizationConsent = false,
  onUpdateSuccess,
  onPublicSubmitSuccess,
  onPublicSubmitError,
  reviewCaptchaSlot,
  recaptchaToken = null,
  brokerOrgId = null,
  publicLinkRef = null,
  publicSourcePortal = null,
  showCoBrokerBorrowerInformationTab = false,
}: LoanApplicationProps = {}) => {
  const coBorrowerRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [lastAddedId, setLastAddedId] = useState<number | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string>(
    initialSelectedProduct,
  );
  const [dynamicSections, setDynamicSections] = useState<any[]>([]);
  const [activeSectionIndex, setActiveSectionIndex] = useState<number | null>(
    null,
  );
  const [dynamicFormData, setDynamicFormData] = useState<Record<string, any>>(
    initialDynamicFormData || {},
  );
  // const [applicationId, setApplicationId] = useState<string>("");
  const [productsMeta, setProductsMeta] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [creditAuthorizationConsent, setCreditAuthorizationConsent] = useState(
    Boolean(initialCreditAuthorizationConsent),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pendingDocuments, setPendingDocuments] = useState<
    PendingApplicationDocument[]
  >([]);
  const pendingDocumentsRef = useRef<PendingApplicationDocument[]>([]);
  pendingDocumentsRef.current = pendingDocuments;

  const [selectedCategory, setSelectedCategory] = useState<LoanCategory>(
    initialSelectedCategory,
  );
  const navigate = useNavigate();
  const portalConfig = useMemo(
    () => getPortalConfig(portal, API_BASE),
    [portal],
  );

  const isResidentialFlow = isResidential14Category(selectedCategory);
  const isCreResidentialLikeFlow = isCreResidentialLikeCategoryProduct(
    selectedCategory,
    selectedProduct,
  );
  const isCreBase44Flow =
    selectedCategory === "CRE_MULTIFAMILY" &&
    isCreBase44Product(selectedProduct);
  const isSba7aBase44Flow =
    selectedCategory === "SBA_USDA" && isSbaBase44Product(selectedProduct);
  const isAblBase44Flow =
    selectedCategory === "ABL" && isAblBase44Product(selectedProduct);
  const isBase44CollateralStep =
    isResidential14Category(selectedCategory) ||
    isCreResidentialLikeFlow ||
    isCreBase44Flow ||
    isSba7aBase44Flow ||
    isAblBase44Flow;
  const isBase44Flow =
    isResidentialFlow ||
    isCreResidentialLikeFlow ||
    isCreBase44Flow ||
    isSba7aBase44Flow ||
    isAblBase44Flow;

  /** SBA/USDA products that use the per-product collateral-type dropdown
   *  (Business / Industry Type or Property Type) backed by
   *  `loanRequest.collateralType`. */
  const isSbaUsdaCollateralFlow =
    isSba7aBase44Flow && isSbaUsdaCollateralProduct(selectedProduct);

  /** ABL products that use the per-product collateral-type dropdown
   *  ("Business / Industry Type") backed by `loanRequest.collateralType`. */
  const isAblCollateralFlow =
    isAblBase44Flow && isAblCollateralProduct(selectedProduct);

  /** Show the standard 7-step stepper until category + loan type are both chosen. */
  const useStandardSevenStepFlow =
    isBase44Flow || !selectedCategory || !selectedProduct;

  const showDefaultEntityInfoFields = !selectedCategory || !selectedProduct;

  const showDefaultPropertyInfoFields = showDefaultEntityInfoFields;

  const showDefaultBorrowerInfoFields = showDefaultEntityInfoFields;

  const useResidentialBorrowerPanel =
    isBase44CollateralStep || showDefaultBorrowerInfoFields;

  const usesBase44Financials = useStandardSevenStepFlow;

  // Embedded-only: surface the "are you a broker?" step in the public-embed
  // share flow when the originating portal is BROKER or LOAN_OFFICER.
  const includeCoBrokerBorrowerInformationTab =
    Boolean(publicEmbed) &&
    Boolean(showCoBrokerBorrowerInformationTab) &&
    (publicSourcePortal === "broker" || publicSourcePortal === "loan_officer");

  // const includeCoBrokerBorrowerInformationTab = true;

  const baseSteps = useStandardSevenStepFlow
    ? [
        "Loan Request",
        "Entity Info",
        selectedCategory === "SBA_USDA" || selectedCategory === "ABL"
          ? "Collateral Info"
          : "Property Info",
        ...(includeCoBrokerBorrowerInformationTab
          ? [CO_BROKER_BORROWER_INFO_STEP]
          : []),
        "Borrower Info",
        "Financials",
        "Documents",
        "Review & Submit",
      ]
    : [
        "Loan Request",
        "Entity Info",
        selectedCategory === "SBA_USDA" || selectedCategory === "ABL"
          ? "Collateral Info"
          : "Property Info",
        ...(includeCoBrokerBorrowerInformationTab
          ? [CO_BROKER_BORROWER_INFO_STEP]
          : []),
        "Borrower Info",
        "Loan Term & Income",
      ];

  const reviewStepIndex = useStandardSevenStepFlow ? baseSteps.length - 1 : -1;

  const handleAmountChange = (
    section: "loanRequest" | "loanTermIncome" | "coBorrower",
    field: string,
    value: string,
    index?: number,
  ) => {
    const formatted = formatCurrency(value);

    if (section === "loanRequest") {
      updateLoanRequest(field, formatted);
    }

    if (section === "loanTermIncome") {
      updateLoanTermIncome(field, formatted);
    }

    if (section === "coBorrower" && index !== undefined) {
      updateCoBorrower(index, field, formatted);
    }
  };

  const toTitleCase = (text: string) => {
    return text
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const allSteps = useStandardSevenStepFlow
    ? baseSteps
    : [
        ...baseSteps,
        ...dynamicSections.map((section) => toTitleCase(section.sectionName)),
      ];

  const [currentStep, setCurrentStep] = useState(0);
  const createEmptyBorrower = (): Borrower => ({
    ...createResidentialBorrowerDefaults(),
    name: "",
    entityName: "",
    phone: "",
    email: "",
    employer: "",
    dob: "",
    ssn: "",
    creditScore: "",
    address: "",
    city: "",
    state: "",
    mailingAddress: "",
  });

  const [formData, setFormData] = useState<FormDataType>(() => {
    // Embedded-only: restore the referring-broker draft from local storage on mount.
    const draft =
      publicEmbed && (publicLinkRef || brokerOrgId)
        ? loadReferringBrokerDraft(publicLinkRef || brokerOrgId)
        : null;
    const referring: ReferringBrokerFormState =
      draft || createEmptyReferringBrokerFormState();

    const base: FormDataType = initialFormData || {
      borrower: createEmptyBorrower(),
      coBorrowers: [],
      loanRequest: {
        purpose: "",
        subPurpose: "",
        amount: "",
        interestRate: "",
        sellerFinancing: "no",
        sellerNoteAmount: "",
        estimatedClosingDate: "",
        rateType: "FIXED",
        brokerPoints: "",
        amortization: "",
        currentMarketValue: "",
        currentLoanBalance: "",
        purchasePrice: "",
        purchaseDate: "",
        totalAssets: "",
        totalLiabilities: "",
        afterRepairValue: "",
        rehabCost: "",
        constructionCost: "",

        propertyType: "",
        subPropertyType: "",
        collateralType: "",
        additionalCollateral: [],
        privateSale: false,
        vendorName: "",
        vendorPhone: "",
        recourse: "",
        businessAddress: "",
        city: "",
        state: "",
        zip: "",
        numberOfUnits: "",
        downPayment: "",
        useOfFunds: "",
        exitStrategy: "",
      },
      loanTermIncome: {
        loanTerm: "",
        monthlyRent: "",
        grossRevenueActual: "",
        grossRevenueProforma: "",
        noiActual: "",
        noiProforma: "",
        annualTaxes: "",
        floodZone: "",
        insurancePremium: "",
        hoaDues: "",
      },
      entity: {
        legalName: "",
        entityType: "",
        dba: "",
        formationDate: "",
        yearsInBusiness: "",
        ebitdaWithNoi: "",
        ...createSbaEntityDefaults(),
      },
      financials: createResidentialFinancialsDefaults(),
      workingWithMortgageBroker: "no",
      referringBroker: {
        email: "",
        firstName: "",
        lastName: "",
        companyName: "",
        phone: "",
      },
    };

    return {
      ...base,
      workingWithMortgageBroker:
        referring.workingWithMortgageBroker ||
        (base.workingWithMortgageBroker as WorkingWithMortgageBrokerAnswer) ||
        "",
      referringBroker: {
        ...createEmptyReferringBroker(),
        ...(base.referringBroker || {}),
        ...referring.referringBroker,
      },
    };
  });

  const [loanProducts, setLoanProducts] = useState<string[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Embedded-only: persist the referring-broker draft to local storage so
  // refreshing the page doesn't lose the "are you a broker?" answers.
  useEffect(() => {
    if (!publicEmbed) return;
    const key = publicLinkRef || brokerOrgId;
    if (!key) return;
    saveReferringBrokerDraft(key, {
      workingWithMortgageBroker:
        (formData.workingWithMortgageBroker as WorkingWithMortgageBrokerAnswer) ||
        "",
      referringBroker: formData.referringBroker || createEmptyReferringBroker(),
    });
  }, [
    publicEmbed,
    publicLinkRef,
    brokerOrgId,
    formData.workingWithMortgageBroker,
    formData.referringBroker,
  ]);

  const handleAddCoBorrower = () => {
    const newId = Date.now();

    setFormData((prev) => ({
      ...prev,
      coBorrowers: [
        ...prev.coBorrowers,
        {
          id: newId,
          ...createEmptyBorrower(),
          currentMarketValue: "",
          purchasePrice: "",
          interestRate: "",
          noi: "",
          totalAssets: "",
          totalLiabilities: "",
        },
      ],
    }));

    setLastAddedId(newId);
  };

  const handleRemoveCoBorrower = (id: number) => {
    setFormData((prev) => ({
      ...prev,
      coBorrowers: prev.coBorrowers.filter((b) => b.id !== id),
    }));
  };

  const updateLoanRequest = (
    field: string,
    value: string | string[] | boolean,
  ) => {
    setFormData((prev) => ({
      ...prev,
      loanRequest: {
        ...prev.loanRequest,
        [field]: value as any,
      },
    }));

    // Live validation: lookup rule for `loanRequest.${field}` and validate
    const fieldKey = `loanRequest.${field}`;
    const rule = getRuleForKey(fieldKey);
    if (rule) {
      const result = validateValue(value, rule);
      console.log(result);

      setErrors((prev) => {
        const updated = { ...prev };
        if (result.hasError) {
          updated[fieldKey] = result.error;
        } else {
          delete updated[fieldKey];
        }
        return updated;
      });
    } else {
      setErrors((prev) => {
        const updated = { ...prev };
        delete updated[`loanRequest.${field}`];
        return updated;
      });
    }
  };

  const updateLoanTermIncome = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      loanTermIncome: {
        ...prev.loanTermIncome,
        [field]: value,
      },
    }));

    const fieldKey = `loanTermIncome.${field}`;
    const rule = getRuleForKey(fieldKey);
    if (rule) {
      const result = validateValue(value, rule);
      console.log(result);

      setErrors((prev) => {
        const updated = { ...prev };
        if (result.hasError) {
          updated[fieldKey] = result.error;
        } else {
          delete updated[fieldKey];
        }
        return updated;
      });
    } else {
      setErrors((prev) => {
        const updated = { ...prev };
        delete updated[fieldKey];
        return updated;
      });
    }
  };

  const updateFinancials = (financials: ResidentialFinancials) => {
    setFormData((prev) => ({
      ...prev,
      financials,
    }));
  };

  useEffect(() => {
    return () => {
      pendingDocumentsRef.current.forEach(revokePendingDocumentPreview);
    };
  }, []);

  const Stat = ({ label, value }: { label: string; value: string }) => (
    <div>
      <p className="text-xs text-slate-500 uppercase">{label}</p>
      <p className="text-[14px] font-semibold text-[#2C92D5]">{value}</p>
    </div>
  );

  const activeProduct = productsMeta.find(
    (p: any) => p.loanProductCode === selectedProduct,
  );

  // EMAIL_REGEX / PHONE_REGEX / SSN_REGEX are imported from ./formatters.
  // ZIP_REGEX is also imported from ./formatters.
  // validateFieldValue / collectStepValidationErrors / collectDynamicSectionErrors
  // validateAllStepsBeforeSubmit / getReviewValidationIssues are imported from
  // ./validation.

  // -----------------------------------------------------------------
  // Inline wrappers for validation/submission helpers that need
  // closure access to local state. They delegate to the imported
  // pure helpers where possible.
  // -----------------------------------------------------------------

  const collectStepValidationErrors = (stepIndex: number) => {
    const newErrors: Record<string, string> = {};
    const purpose = formData.loanRequest.purpose;
    const propertyPurchaseDateVisible =
      !!selectedProduct &&
      !shouldHidePropertyPurchaseDate(selectedProduct, purpose);

    const checkObject = (obj: Record<string, any>, prefix: string) => {
      Object.entries(obj).forEach(([key, value]) => {
        if (
          key === "mailingAddress" ||
          key === "id" ||
          key === "dba" ||
          key === "ebitdaWithNoi" ||
          key === "naicsCode" ||
          key === "goodwillAmount" ||
          key === "inventoryIncluded" ||
          key === "inventoryValue" ||
          key === "equipmentIncluded" ||
          key === "equipmentValue" ||
          key === "hoaDues"
        )
          return;
        const error = validateFieldValue(key, value, true);
        if (error) newErrors[`${prefix}.${key}`] = error;
      });
    };

    if (stepIndex === 0) {
      if (!selectedCategory) newErrors["category"] = "Category is required";
      if (!selectedProduct)
        newErrors["selectedProduct"] = "Program selection is required";
      if (selectedProduct) {
        if (!formData.loanRequest.purpose?.trim())
          newErrors["loanRequest.purpose"] = "Loan purpose is required";
        const subPurposeList = LOAN_SUB_PURPOSE_MAP[selectedProduct] || [];
        if (
          subPurposeList.length > 0 &&
          formData.loanRequest.purpose?.trim() &&
          !formData.loanRequest.subPurpose?.trim()
        ) {
          newErrors["loanRequest.subPurpose"] = "Sub-loan purpose is required";
        }
        const amount = toNumber(formData.loanRequest.amount);
        if (!amount || amount <= 0)
          newErrors["loanRequest.amount"] =
            "Requested loan amount must be greater than 0";
        if (
          isLoanRequestPurchaseDateField(selectedProduct, purpose) &&
          !formData.loanRequest.purchaseDate?.trim()
        ) {
          newErrors["loanRequest.purchaseDate"] =
            isLoanRequestOriginalPurchaseDate(selectedProduct, purpose)
              ? "Original purchase date is required"
              : "Purchase date is required";
        }
      }
    }
    if (stepIndex === 1) {
      if (showDefaultEntityInfoFields) {
        if (!formData.entity.legalName?.trim())
          newErrors["entity.legalName"] =
            "Legal business / entity name is required";
        if (!formData.entity.entityType?.trim())
          newErrors["entity.entityType"] = "Entity type is required";
        if (!formData.entity.formationDate?.trim())
          newErrors["entity.formationDate"] = "Formation date is required";
        if (!formData.entity.yearsInBusiness?.trim()) {
          newErrors["entity.yearsInBusiness"] = "Years in business is required";
        } else if (Number(formData.entity.yearsInBusiness) < 0) {
          newErrors["entity.yearsInBusiness"] =
            "Years in business cannot be negative";
        }
      } else {
        checkObject(formData.entity, "entity");
        if (Number(formData.entity.yearsInBusiness) < 0)
          newErrors["entity.yearsInBusiness"] =
            "Years in business cannot be negative";
        if (
          isSba7aBase44Flow &&
          formData.entity.inventoryIncluded &&
          toNumber(formData.entity.inventoryValue) <= 0
        )
          newErrors["entity.inventoryValue"] =
            "Inventory value must be greater than 0";
        if (
          isSba7aBase44Flow &&
          formData.entity.equipmentIncluded &&
          toNumber(formData.entity.equipmentValue) <= 0
        )
          newErrors["entity.equipmentValue"] =
            "Equipment value must be greater than 0";
      }
    }
    if (stepIndex === 2) {
      if (showDefaultPropertyInfoFields) {
        if (!formData.loanRequest.businessAddress?.trim())
          newErrors["loanRequest.businessAddress"] =
            "Property address is required";
        if (!formData.loanRequest.city?.trim())
          newErrors["loanRequest.city"] = "City is required";
        if (!formData.loanRequest.state?.trim())
          newErrors["loanRequest.state"] = "State is required";
        if (!formData.loanRequest.zip?.trim())
          newErrors["loanRequest.zip"] = "ZIP is required";
      } else if (isBase44CollateralStep) {
        if (isSbaUsdaCollateralFlow || isAblCollateralFlow) {
          if (!formData.loanRequest.collateralType?.trim()) {
            const label = isAblCollateralFlow
              ? "Business / industry type"
              : getSbaCollateralTypeLabel(selectedProduct) ||
                "Business / industry type";
            newErrors["loanRequest.collateralType"] = `${label} is required`;
          }
        } else if (!formData.loanRequest.propertyType?.trim()) {
          newErrors["loanRequest.propertyType"] =
            isBase44BusinessCollateralProduct(selectedProduct)
              ? "Business / industry type is required"
              : "Property type is required";
        }
        if (
          isCreResidentialLikeFlow &&
          !formData.loanRequest.subPropertyType?.trim()
        )
          newErrors["loanRequest.subPropertyType"] =
            "Sub property type is required";
        if (!formData.loanRequest.businessAddress?.trim())
          newErrors["loanRequest.businessAddress"] =
            "Property address is required";
        if (!formData.loanRequest.city?.trim())
          newErrors["loanRequest.city"] = "City is required";
        if (!formData.loanRequest.state?.trim())
          newErrors["loanRequest.state"] = "State is required";
        if (!formData.loanRequest.zip?.trim())
          newErrors["loanRequest.zip"] = "ZIP is required";
        if (
          showResidentialPropertyPurchasePrice(selectedProduct, purpose) &&
          toNumber(formData.loanRequest.purchasePrice) <= 0
        )
          newErrors["loanRequest.purchasePrice"] =
            "Purchase price must be greater than 0";
        if (
          showResidentialPropertyPurchasePrice(selectedProduct, purpose) &&
          equityMismatchError
        )
          newErrors["loanRequest.downPayment"] =
            "Loan Amount + Down Payment + Seller Financing must equal the Purchase Price";
        if (
          showResidentialPropertyMarketValue(selectedProduct, purpose) &&
          toNumber(formData.loanRequest.currentMarketValue) <= 0
        )
          newErrors["loanRequest.currentMarketValue"] =
            "Current market value must be greater than 0";
        if (
          showResidentialPropertyArv(selectedProduct) &&
          toNumber(formData.loanRequest.afterRepairValue) <= 0
        )
          newErrors["loanRequest.afterRepairValue"] =
            "After repair value must be greater than 0";
        if (
          showResidentialPropertyRehabCost(selectedProduct) &&
          toNumber(formData.loanRequest.rehabCost) <= 0
        )
          newErrors["loanRequest.rehabCost"] =
            "Rehab cost must be greater than 0";
        if (
          showResidentialPropertyConstructionCost(selectedProduct) &&
          toNumber(formData.loanRequest.constructionCost) <= 0
        )
          newErrors["loanRequest.constructionCost"] =
            "Construction cost must be greater than 0";
        if (
          propertyPurchaseDateVisible &&
          !formData.loanRequest.purchaseDate?.trim()
        )
          newErrors["loanRequest.purchaseDate"] = "Purchase date is required";
      } else {
        Object.entries(formData.loanRequest).forEach(([key, value]) => {
          if (OPTIONAL_LOAN_REQUEST_KEYS.has(key)) return;
          if (
            shouldHidePropertyPurchaseDate(selectedProduct, purpose) &&
            key === "purchaseDate"
          )
            return;
          const error = validateFieldValue(key, value, true);
          if (error) newErrors[`loanRequest.${key}`] = error;
        });
        if (toNumber(formData.loanRequest.totalAssets) <= 0)
          newErrors["loanRequest.totalAssets"] =
            "Total Assets must be greater than 0";
        if (toNumber(formData.loanRequest.totalLiabilities) < 0)
          newErrors["loanRequest.totalLiabilities"] =
            "Liabilities cannot be negative";
        if (!formData.loanRequest.businessAddress)
          newErrors["loanRequest.businessAddress"] = "Address is required";
        if (!formData.loanRequest.city)
          newErrors["loanRequest.city"] = "City is required";
        if (!formData.loanRequest.state)
          newErrors["loanRequest.state"] = "State is required";
        if (!formData.loanRequest.zip)
          newErrors["loanRequest.zip"] = "ZIP is required";
      }
    }
    // Embedded-only: "are you a broker?" step. When the public-embed flow
    // surfaces this step it lives at index 3, so validate it before we
    // fall through to the borrower step (which is shifted to index 4 in
    // that case).
    if (includeCoBrokerBorrowerInformationTab && stepIndex === 3) {
      const referringErrors = validateReferringBrokerStep({
        workingWithMortgageBroker: formData.workingWithMortgageBroker || "",
        referringBroker:
          formData.referringBroker || createEmptyReferringBroker(),
      });
      Object.assign(newErrors, referringErrors);
    }

    const borrowerStepIndex = includeCoBrokerBorrowerInformationTab ? 4 : 3;
    if (stepIndex === borrowerStepIndex) {
      if (useResidentialBorrowerPanel) {
        if (!formData.borrower.firstName?.trim())
          newErrors["borrower.firstName"] = "First name is required";
        if (!formData.borrower.lastName?.trim())
          newErrors["borrower.lastName"] = "Last name is required";
        if (formData.borrower.phone?.trim()) {
          const e = validateFieldValue("phone", formData.borrower.phone, false);
          if (e) newErrors["borrower.phone"] = e;
        }
        if (formData.borrower.email?.trim()) {
          const e = validateFieldValue("email", formData.borrower.email, false);
          if (e) newErrors["borrower.email"] = e;
        }
        if (formData.borrower.ssn?.trim()) {
          const e = validateFieldValue("ssn", formData.borrower.ssn, false);
          if (e) newErrors["borrower.ssn"] = e;
        }
      } else {
        checkObject(formData.borrower, "borrower");
      }
    }
    if (
      stepIndex === (includeCoBrokerBorrowerInformationTab ? 5 : 4) &&
      !usesBase44Financials
    ) {
      checkObject(formData.loanTermIncome, "loanTermIncome");
      const loanTerm = Number(formData.loanTermIncome.loanTerm);
      if (loanTerm && loanTerm <= 0)
        newErrors["loanTermIncome.loanTerm"] =
          "Loan term must be greater than 0";
      const noi = Number(formData.loanTermIncome.noiActual);
      if (noi && noi < 0)
        newErrors["loanTermIncome.noiActual"] = "NOI cannot be negative";
    }
    return newErrors;
  };

  const getReviewValidationIssues = (): any[] => {
    const issues: any[] = [];
    const add = (label: string, stepIndex: number, missing: boolean) => {
      if (missing) issues.push({ label, stepIndex });
    };
    add("Loan Category", 0, !selectedCategory);
    add("Loan Program", 0, !selectedProduct);
    add("Loan Purpose", 0, !formData.loanRequest.purpose?.trim());
    add("Loan Amount", 0, toNumber(formData.loanRequest.amount) <= 0);
    add("Closing Date", 0, !formData.loanRequest.estimatedClosingDate?.trim());
    const purpose = formData.loanRequest.purpose;
    if (
      selectedProduct &&
      isLoanRequestPurchaseDateField(selectedProduct, purpose) &&
      !formData.loanRequest.purchaseDate?.trim()
    ) {
      add(
        isLoanRequestOriginalPurchaseDate(selectedProduct, purpose)
          ? "Original Purchase Date"
          : "Purchase Date",
        0,
        true,
      );
    }
    add("Legal Business / Entity Name", 1, !formData.entity.legalName?.trim());
    add("Entity Type", 1, !formData.entity.entityType?.trim());
    add("Formation Date", 1, !formData.entity.formationDate?.trim());
    add("Years in Business", 1, !formData.entity.yearsInBusiness?.trim());

    if (showDefaultPropertyInfoFields) {
      add("Property Address", 2, !formData.loanRequest.businessAddress?.trim());
      add("City", 2, !formData.loanRequest.city?.trim());
      add("State", 2, !formData.loanRequest.state?.trim());
      add("ZIP", 2, !formData.loanRequest.zip?.trim());
    } else if (isSbaUsdaCollateralFlow || isAblCollateralFlow) {
      add(
        isAblCollateralFlow
          ? "Business / Industry Type"
          : getSbaCollateralTypeLabel(selectedProduct) ||
              "Business / Industry Type",
        2,
        !formData.loanRequest.collateralType?.trim(),
      );
    }
    if (useResidentialBorrowerPanel) {
      const borrowerStepIndex = includeCoBrokerBorrowerInformationTab ? 4 : 3;
      add(
        "Borrower Email",
        borrowerStepIndex,
        !formData.borrower.email?.trim(),
      );
      const unanswered = countUnansweredDeclarations(
        formData.borrower.declarations,
      );
      if (unanswered > 0) {
        add(
          unanswered === 1
            ? "Declarations (1 unanswered)"
            : `Declarations (${unanswered} unanswered)`,
          borrowerStepIndex,
          true,
        );
      }
      formData.coBorrowers.forEach((coBorrower, index) => {
        if (!coBorrower.email?.trim()) {
          add(`Co-Borrower ${index + 1} Email`, borrowerStepIndex, true);
        }
        const coUnanswered = countUnansweredDeclarations(
          coBorrower.declarations,
        );
        if (coUnanswered > 0) {
          add(
            coUnanswered === 1
              ? `Co-Borrower ${index + 1} Declarations (1 unanswered)`
              : `Co-Borrower ${index + 1} Declarations (${coUnanswered} unanswered)`,
            borrowerStepIndex,
            true,
          );
        }
      });
    }

    // Embedded-only: surface the "are you a broker?" review issues only
    // when the originating portal exposes the co-broker tab. When the tab
    // is hidden, skip these checks entirely so empty fields don't show up
    // in the review section.
    if (includeCoBrokerBorrowerInformationTab) {
      const referringErrors = validateReferringBrokerStep({
        workingWithMortgageBroker: formData.workingWithMortgageBroker || "",
        referringBroker:
          formData.referringBroker || createEmptyReferringBroker(),
      });
      const coBrokerStepIndex = 3;
      if (referringErrors.workingWithMortgageBroker) {
        add("Mortgage Broker Question", coBrokerStepIndex, true);
      }
      if (referringErrors["referringBroker.email"]) {
        add("Referring Broker Email", coBrokerStepIndex, true);
      }
      if (referringErrors["referringBroker.firstName"]) {
        add("Referring Broker First Name", coBrokerStepIndex, true);
      }
      if (referringErrors["referringBroker.lastName"]) {
        add("Referring Broker Last Name", coBrokerStepIndex, true);
      }
      if (referringErrors["referringBroker.companyName"]) {
        add("Referring Broker Company", coBrokerStepIndex, true);
      }
      if (referringErrors["referringBroker.phone"]) {
        add("Referring Broker Phone", coBrokerStepIndex, true);
      }
    }
    return issues;
  };

  const validateAllStepsBeforeSubmit = (): boolean => {
    let newErrors: Record<string, string> = {};
    for (let i = 0; i < baseSteps.length; i++) {
      newErrors = { ...newErrors, ...collectStepValidationErrors(i) };
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleReviewSubmit = () => {
    const issues = getReviewValidationIssues();
    if (issues.length > 0) {
      toast.error("Please complete all required fields before submitting");
      return;
    }
    if (!creditAuthorizationConsent) {
      toast.error(
        "Please agree to the Credit Authorization Consent before submitting",
      );
      return;
    }
    handleSubmitApplication();
  };

  const updateEntity = (field: string, value: string | boolean) => {
    setFormData((prev) => ({
      ...prev,
      entity: {
        ...prev.entity,
        [field]: value,
      },
    }));

    const fieldKey = `entity.${field}`;
    const rule = getRuleForKey(fieldKey);
    if (rule) {
      const result = validateValue(value, rule);
      setErrors((prev) => {
        const updated = { ...prev };
        if (result.hasError) {
          updated[fieldKey] = result.error;
        } else {
          delete updated[fieldKey];
        }
        return updated;
      });
    } else {
      setErrors((prev) => {
        const updated = { ...prev };
        delete updated[fieldKey];
        return updated;
      });
    }
  };

  const handleSubmitApplication = async () => {
    try {
      if (useStandardSevenStepFlow && getReviewValidationIssues().length > 0) {
        toast.error("Please complete all required fields before submitting");
        return;
      }

      if (useStandardSevenStepFlow && !creditAuthorizationConsent) {
        toast.error(
          "Please agree to the Credit Authorization Consent before submitting",
        );
        return;
      }

      if (!selectedProduct) {
        toast.error("Please select a loan product");
        return;
      }

      setSubmitting(true);

      const allProductFields = [
        ...(activeProduct?.unsectionedFields || []),
        ...(activeProduct?.sections || []).flatMap(
          (section: any) => section.fields || [],
        ),
      ];

      const fieldIdByKey = new Map<string, string>(
        allProductFields
          .filter((field: any) => field.fieldKey && field.fieldId)
          .map((field: any) => [field.fieldKey, field.fieldId]),
      );

      const fieldsMap = new Map<string, { value: any; fieldId?: string }>();

      const addField = (key: string, value: any, fieldId?: string) => {
        if (value === undefined || value === null || value === "") return;

        if (typeof value === "string") {
          value = value.trim();
        }

        const resolvedFieldId = fieldId ?? fieldIdByKey.get(key);

        fieldsMap.set(key, {
          value,
          ...(resolvedFieldId ? { fieldId: resolvedFieldId } : {}),
        });
      };

      /* ================= BORROWER ================= */

      if (usesBase44Financials) {
        appendResidentialBorrowerSubmission(addField, formData.borrower);

        formData.coBorrowers.forEach((borrower, index) => {
          appendResidentialBorrowerSubmission(
            addField,
            borrower,
            `coBorrower_${index + 1}`,
          );
        });
      } else {
        const fullName = formData.borrower.name.trim().split(" ");
        const firstName = fullName[0] || "";
        const lastName = fullName.slice(1).join(" ") || "";

        addField("borrowerFirstName", firstName);
        addField("borrowerLastName", lastName);
        addField("companyName", formData.borrower.entityName);
        addField("email", formData.borrower.email?.toLowerCase());
        addField("phone", formData.borrower.phone);
        addField("creditScore", formData.borrower.creditScore);

        addField("borrowerCity", formData.borrower.city);
        addField("borrowerState", formData.borrower.state);
        addField("borrowerCountry", "USA");
        addField("dob", formData.borrower.dob);
        addField("ssn", formData.borrower.ssn);
        addField("address", formData.borrower.address);
        addField("mailingAddress", formData.borrower.mailingAddress);
        addField("employer", formData.borrower.employer);
      }

      /* ================= LOAN REQUEST ================= */

      const canonicalLoanProductCode =
        resolveCanonicalLoanProductCode(selectedProduct);
      addField("loanProductCode", canonicalLoanProductCode);
      addField("loanCategory", selectedCategory);
      addField("amountRequested", toNumber(formData.loanRequest.amount));
      addField("interestRate", formData.loanRequest.interestRate);
      addField("purpose", formData.loanRequest.purpose);
      addField("subPurpose", formData.loanRequest.subPurpose);
      addField("propertyType", formData.loanRequest.propertyType);
      addField("subPropertyType", formData.loanRequest.subPropertyType);
      addField("recourse", formData.loanRequest.recourse);
      addField("sellerFinancing", formData.loanRequest.sellerFinancing);
      addField(
        "sellerNoteAmount",
        toNumber(formData.loanRequest.sellerNoteAmount),
      );
      addField(
        "estimatedClosingDate",
        formData.loanRequest.estimatedClosingDate,
      );
      addField("rateType", formData.loanRequest.rateType);
      addField("brokerPoints", formData.loanRequest.brokerPoints);
      addField("amortization", formData.loanRequest.amortization);

      /* ================= PROPERTY LOCATION ================= */

      addField("propertyAddress", formData.loanRequest.businessAddress);
      addField("propertyCity", formData.loanRequest.city);
      addField("propertyState", formData.loanRequest.state);
      addField("propertyZip", formData.loanRequest.zip?.replace(/\D/g, ""));
      addField("propertyCountry", "USA");
      addField("numberOfUnits", formData.loanRequest.numberOfUnits);

      /* ================= LOAN TERM & ENTITY ================= */

      addField("loanTerm", formData.loanTermIncome.loanTerm);

      addField("entityLegalName", formData.entity.legalName);
      addField("entityType", formData.entity.entityType);
      addField("dba", formData.entity.dba);
      addField("formationDate", formData.entity.formationDate);
      addField("yearsInBusiness", formData.entity.yearsInBusiness);
      addField("ebitda", toNumber(formData.entity.ebitdaWithNoi));
      addField("naicsCode", formData.entity.naicsCode);
      addField("naics", formData.entity.naicsCode);
      addField("goodwillAmount", toNumber(formData.entity.goodwillAmount));
      addField(
        "inventoryIncluded",
        formData.entity.inventoryIncluded ? "yes" : "no",
      );
      addField(
        "equipmentIncluded",
        formData.entity.equipmentIncluded ? "yes" : "no",
      );
      addField("inventoryValue", toNumber(formData.entity.inventoryValue));
      addField("equipmentValue", toNumber(formData.entity.equipmentValue));
      addField(
        "businessIndustry",
        isSbaUsdaCollateralFlow || isAblCollateralFlow
          ? formData.loanRequest.collateralType
          : formData.loanRequest.propertyType,
      );

      // Additional Collateral: emit as a single string[] field
      if (
        (isSbaUsdaCollateralFlow || isAblCollateralFlow) &&
        formData.loanRequest.additionalCollateral.length > 0
      ) {
        addField("additionalCollateral", [
          ...formData.loanRequest.additionalCollateral,
        ]);
      }

      // Sale Details (SBA/USDA + ABL only)
      if (isSbaUsdaCollateralFlow || isAblCollateralFlow) {
        addField(
          "privateSale",
          formData.loanRequest.privateSale ? "yes" : "no",
        );
        addField("vendorName", formData.loanRequest.vendorName);
        addField("vendorPhone", formData.loanRequest.vendorPhone);
      }

      addField(
        "currentMarketValue",
        toNumber(formData.loanRequest.currentMarketValue),
      );
      addField(
        "afterRepairValue",
        toNumber(formData.loanRequest.afterRepairValue),
      );
      addField("purchasePrice", toNumber(formData.loanRequest.purchasePrice));
      addField("downPayment", toNumber(formData.loanRequest.downPayment));
      addField("useOfFunds", formData.loanRequest.useOfFunds);
      addField("exitStrategy", formData.loanRequest.exitStrategy);
      addField("rehabBudget", toNumber(formData.loanRequest.rehabCost));
      addField(
        "constructionBudget",
        toNumber(formData.loanRequest.constructionCost),
      );
      addField("purchaseDate", formData.loanRequest.purchaseDate);
      addField("totalAssets", borrowerAssets);
      addField("totalLiabilities", borrowerLiabilities);

      if (usesBase44Financials) {
        appendResidentialFinancialsSubmission(addField, formData.financials);
      } else {
        addField("noiActual", formData.loanTermIncome.noiActual);
        addField("monthlyRent", formData.loanTermIncome.monthlyRent);
        addField(
          "grossRevenueActual",
          formData.loanTermIncome.grossRevenueActual,
        );
        addField(
          "grossRevenueProforma",
          formData.loanTermIncome.grossRevenueProforma,
        );
        addField("noiProforma", formData.loanTermIncome.noiProforma);
        addField("annualTaxes", formData.loanTermIncome.annualTaxes);
        addField("floodZone", formData.loanTermIncome.floodZone);
        addField("insurancePremium", formData.loanTermIncome.insurancePremium);
        addField("hoaDues", formData.loanTermIncome.hoaDues);
      }

      /* ================= CO BORROWERS ================= */

      if (!usesBase44Financials) {
        formData.coBorrowers.forEach((borrower, index) => {
          const i = index + 1;

          const toNum = (v: string) => parseFloat(v?.replace(/,/g, "") || "0");

          const coLoanAmount =
            formData.coBorrowers.length > 0
              ? loanAmount / formData.coBorrowers.length
              : loanAmount;

          const coMarketValue = toNum(borrower.currentMarketValue);
          const coPurchasePrice = toNum(borrower.purchasePrice);
          const coInterest = borrower.interestRate
            ? toNum(borrower.interestRate)
            : interestRate;

          const coNoi = toNum(borrower.noi);
          const coAssets = toNum(borrower.totalAssets);
          const coLiabilities = toNum(borrower.totalLiabilities);

          const coNetWorth = coAssets - coLiabilities;

          const coLtv =
            coMarketValue > 0 ? (coLoanAmount / coMarketValue) * 100 : 0;

          const coLtc =
            coPurchasePrice > 0 ? (coLoanAmount / coPurchasePrice) * 100 : 0;

          const coAnnualDebt =
            calculateMonthlyPayment(coLoanAmount, coInterest, termMonths) * 12;

          const coDscr =
            coAnnualDebt > 0 && coNoi > 0 ? coNoi / coAnnualDebt : 0;

          // original fields
          Object.entries(borrower).forEach(([key, value]) => {
            if (key === "id") return;
            addField(`coBorrower_${i}_${key}`, value);
          });

          // calculated
          addField(`coBorrower_${i}_netWorth`, coNetWorth);
          addField(`coBorrower_${i}_ltv`, coLtv);
          addField(`coBorrower_${i}_ltc`, coLtc);
          addField(`coBorrower_${i}_dscr`, coDscr);
        });
      }

      /* ================= DYNAMIC FIELDS ================= */

      const allDynamicFields = allProductFields;

      Object.entries(dynamicFormData).forEach(([fieldId, value]) => {
        if (!value || value instanceof File) return;

        const fieldMeta = allDynamicFields.find(
          (f: any) => f.fieldId === fieldId,
        );

        const key = fieldMeta?.fieldKey || fieldMeta?.label || fieldId;

        addField(key, value, fieldId);
      });

      /* ================= CALCULATED ================= */

      addField("ltvPercentage", ltv !== "—" ? Number(ltv) : 0);
      addField("ltcPercentage", ltc !== "—" ? Number(ltc) : 0);
      addField("arvPercentage", arv !== "—" ? Number(arv) : 0);
      addField("dscr", dscr !== "—" ? Number(dscr) : 0);

      addField("totalAssets", borrowerAssets);
      addField("totalLiabilities", borrowerLiabilities);
      addField("netWorth", netWorth);

      pendingDocuments.forEach((doc, index) => {
        addField(`applicationDocument_${index}_fileName`, doc.fileName);
        addField(`applicationDocument_${index}_documentType`, doc.documentType);
      });
      addField("applicationDocumentCount", pendingDocuments.length);
      addField(
        "creditAuthorizationConsent",
        creditAuthorizationConsent ? "yes" : "no",
      );

      /* ================= FINAL PAYLOAD ================= */

      const fields = Array.from(fieldsMap.entries()).map(
        ([fieldKey, { value, fieldId }]) => ({
          fieldKey,
          value,
          ...(fieldId ? { fieldId } : {}),
        }),
      );

      // Embedded-only: when the public-embed flow surfaces the
      // "are you a broker?" step, append the referring-broker fields
      // so the originating broker can see them in the dashboard.
      if (includeCoBrokerBorrowerInformationTab) {
        appendReferringBrokerSubmission(
          (key, value) => {
            if (
              value === undefined ||
              value === null ||
              value === "" ||
              (Array.isArray(value) && value.length === 0)
            ) {
              return;
            }
            fields.push({
              fieldKey: key,
              value: typeof value === "string" ? value.trim() : value,
            });
          },
          {
            workingWithMortgageBroker:
              (formData.workingWithMortgageBroker as WorkingWithMortgageBrokerAnswer) ||
              "",
            referringBroker:
              formData.referringBroker || createEmptyReferringBroker(),
          },
        );
      }

      const payload = {
        loanProductCode: resolveCanonicalLoanProductCode(selectedProduct),
        fields,
      };

      const token = sessionStorage.getItem(portalConfig.tokenKey);

      if (mode === "update" && editApplicationId) {
        const response = await fetch(portalConfig.editUrl(editApplicationId), {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            fields: payload.fields,
          }),
        });

        const result = await response.json();

        if (!response.ok || result.success !== true) {
          throw new Error(result.message || "Update failed");
        }

        // Upload any newly added documents in Step 6 — without this the
        // broker can re-tag and upload files during edit, but they never
        // reach the backend. Edit endpoint returns the existing
        // `submissionId` so we can re-use the same requirement/upload flow
        // as a fresh submission.
        const submissionId = result?.data?.submissionId;
        if (pendingDocuments.length > 0 && submissionId) {
          try {
            await uploadPendingApplicationDocuments({
              apiBase: API_BASE,
              token,
              loanApplicationId: editApplicationId,
              submissionId,
              documents: pendingDocuments,
            });
          } catch (uploadError: any) {
            toast.error(
              uploadError.message ||
                "Application updated but some documents failed to upload",
            );
            navigate(portalConfig.successPath);
            return;
          }
        }

        toast.success("Application Updated Successfully");
        onUpdateSuccess?.(result.data?.submissionId);
        if (!embedded) {
          navigate(portalConfig.successPath);
        }
        return;
      }

      if (publicEmbed) {
        const publicFields = withBorrowerNameFields([...payload.fields]);
        const hasFirstName = publicFields.some(
          (f) => f.fieldKey === "first_name",
        );
        const hasLastName = publicFields.some(
          (f) => f.fieldKey === "last_name",
        );

        if (!hasFirstName) {
          publicFields.push({
            fieldKey: "first_name",
            value:
              formData.borrower.firstName ||
              formData.borrower.name?.trim().split(/\s+/)[0] ||
              "",
          });
        }

        if (!hasLastName) {
          const nameParts = formData.borrower.name?.trim().split(/\s+/) || [];
          publicFields.push({
            fieldKey: "last_name",
            value:
              formData.borrower.lastName || nameParts.slice(1).join(" ") || "",
          });
        }

        const response = await fetch(
          `${API_BASE}/api/public/broker/applications/submit`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              ...payload,
              ...(publicLinkRef ? { ref: publicLinkRef } : {}),
              ...(!publicLinkRef && brokerOrgId
                ? { brokerOrgId }
                : {}),
              fields: publicFields,
            }),
          },
        );

        const result = await response.json();

        if (!response.ok || result.success !== true) {
          throw new Error(result.message || "Submission failed");
        }

        const publicSubmissionId = result?.data?.submissionId;
        const publicLoanApplicationId = result?.data?.loanApplicationId;

        // Upload any documents the borrower staged in Step 6 — the public
        // submit endpoint only persists form fields, so without this the
        // broker dashboard would show zero documents for this submission.
        if (
          pendingDocuments.length > 0 &&
          publicLoanApplicationId &&
          publicSubmissionId
        ) {
          try {
            await uploadPublicPendingDocuments({
              apiBase: API_BASE,
              loanApplicationId: publicLoanApplicationId,
              submissionId: publicSubmissionId,
              documents: pendingDocuments,
            });
          } catch (uploadError: any) {
            toast.error(
              uploadError.message ||
                "Application submitted but some documents failed to upload",
            );
            onPublicSubmitSuccess?.(publicSubmissionId);
            return;
          }
        }

        if (pendingDocuments.length > 0) {
          toast.success(
            "Application submitted with documents. Client portal access link sent to borrower email.",
          );
        } else {
          toast.success(
            "Application submitted. Client portal access link sent to borrower email.",
          );
        }

        onPublicSubmitSuccess?.(publicSubmissionId);
        return;
      }

      const response = await fetch(portalConfig.submitUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...payload,
          fields: withBorrowerNameFields(payload.fields),
        }),
      });

      const result = await response.json();

      if (!response.ok || result.success !== true) {
        throw new Error(result.message || "Submission failed");
      }

      const loanApplicationId = result?.data?.applicationId;
      const submissionId = result?.data?.submissionId;

      if (pendingDocuments.length > 0 && loanApplicationId && submissionId) {
        try {
          await uploadPendingApplicationDocuments({
            apiBase: API_BASE,
            token,
            loanApplicationId,
            submissionId,
            documents: pendingDocuments,
          });
        } catch (uploadError: any) {
          toast.error(
            uploadError.message ||
              "Application saved but some documents failed to upload",
          );
          navigate(portalConfig.successPath);
          return;
        }
      }

      toast.success(
        "Application submitted. Client portal access link sent to borrower email.",
      );
      navigate(portalConfig.successPath);
    } catch (error: any) {
      toast.error(error.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const fetchLoanProducts = async () => {
      try {
        setLoadingProducts(true);

        const data = await fetchLoanProductCatalog(portalConfig);
        const products = data?.products || [];

        // If catalog is empty/unreachable codes, still allow category-mapped products.
        if (products.length === 0) {
          const allCategoryCodes = Array.from(
            new Set(Object.values(CATEGORY_LOAN_TYPES).flat()),
          );
          setProductsMeta(
            allCategoryCodes.map((code) => ({
              productId: code,
              loanProductCode: code,
              name: PRODUCT_LABELS[code] || code,
              sections: [],
              unsectionedFields: [],
            })),
          );
        } else {
          setProductsMeta(products);
        }

        // setApplicationId("");
        setLoanProducts([]);
        setDynamicSections([]);
      } catch (error: any) {
        console.error("Error fetching loan products:", error);

        // Local fallback so the form remains usable without Application Builder
        const allCategoryCodes = Array.from(
          new Set(Object.values(CATEGORY_LOAN_TYPES).flat()),
        );
        setProductsMeta(
          allCategoryCodes.map((code) => ({
            productId: code,
            loanProductCode: code,
            name: PRODUCT_LABELS[code] || code,
            sections: [],
            unsectionedFields: [],
          })),
        );
        // setApplicationId("");
        setLoanProducts([]);
        setDynamicSections([]);
        toast.error(
          error.message ||
            "Catalog unavailable — using built-in loan product list",
        );
      } finally {
        setLoadingProducts(false);
      }
    };

    fetchLoanProducts();
  }, [portal, portalConfig]);

  const fetchSectionsByProduct = async () => {
    // Application Builder removed — form fields are static per product flow.
    setDynamicSections([]);
  };

  useEffect(() => {
    if (!lastAddedId) return;

    const el = coBorrowerRefs.current[lastAddedId];

    if (el) {
      el.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [lastAddedId]);

  // toNumber / calculateMonthlyPayment are imported from ./formatters.

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
  const rehabCost = toNumber(formData.loanRequest.rehabCost);
  const constructionCost = toNumber(formData.loanRequest.constructionCost);
  const totalFlipCost = purchasePrice + rehabCost;
  const totalConstructionCost = purchasePrice + constructionCost;

  // Equity / Down Payment derived values (live validation)
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
  // Use a small tolerance to avoid float-comparison false positives
  // (e.g. user-entered decimals like 100000.01 vs 100000.005).
  const equityMismatchError =
    hasPurchasePrice && Math.abs(equityGrandTotal - purchasePriceTotal) >= 0.01;

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

  const afterRepairValue = toNumber(formData.loanRequest.afterRepairValue);

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

  const interestRate = toNumber(formData.loanRequest.interestRate);
  const amortizationYears = toNumber(formData.loanRequest.amortization);
  const fallbackTermMonths = toNumber(formData.loanTermIncome.loanTerm);
  const termMonths =
    amortizationYears > 0 ? amortizationYears * 12 : fallbackTermMonths;
  const isInterestOnly = formData.loanRequest.rateType === "INTEREST_ONLY";

  // Interest-only loans pay only accrued interest each month — the
  // Loan Term field is hidden on step 0 in that case, so termMonths
  // does not factor into the payment calculation.
  const monthlyPayment = isInterestOnly
    ? (loanAmount * (interestRate / 100)) / 12
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

  const handleDynamicFieldChange = (fieldId: string, value: any) => {
    setDynamicFormData((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
  };

  const renderField = (field: any, hasError?: boolean) => {
    const commonClasses = `
  w-full px-4 py-1 text-sm rounded-md border transition
  ${
    hasError
      ? "border-red-500 bg-red-50 dark:bg-red-900/20"
      : "border-slate-300 dark:border-slate-600"
  }
  bg-white dark:bg-slate-900
  text-slate-800 dark:text-slate-200
  focus:ring-2 focus:ring-blue-500/20
  focus:border-blue-500
  outline-none
  `;

    switch (field.type) {
      case "TEXT": {
        const lowerKey = (field.fieldKey || field.label || "").toLowerCase();

        const isPhone = lowerKey.includes("phone");
        const isSSN = lowerKey.includes("ssn");

        return (
          <input
            type="text"
            inputMode={isPhone || isSSN ? "numeric" : "text"}
            placeholder={field.placeholder || ""}
            required={field.required}
            value={dynamicFormData[field.fieldId] || ""}
            onChange={(e) => {
              let value = e.target.value;

              if (isPhone) {
                value = formatUSPhone(value);
              }

              if (isSSN) {
                value = formatSSN(value);
              }

              handleDynamicFieldChange(field.fieldId, value);
            }}
            className={commonClasses}
          />
        );
      }

      case "TEXTAREA":
      case "textarea":
        return (
          <textarea
            rows={4}
            placeholder={field.placeholder || ""}
            required={field.required}
            value={dynamicFormData[field.fieldId] || ""}
            onChange={(e) =>
              handleDynamicFieldChange(field.fieldId, e.target.value)
            }
            className={commonClasses}
          />
        );

      case "EMAIL":
        return (
          <input
            type="email"
            placeholder={field.placeholder || ""}
            required={field.required}
            value={dynamicFormData[field.fieldId] || ""}
            onChange={(e) =>
              handleDynamicFieldChange(field.fieldId, e.target.value)
            }
            className={commonClasses}
          />
        );

      case "NUMBER": {
        const lowerKey = (field.fieldKey || field.label || "").toLowerCase();

        const isPhone = lowerKey.includes("phone");
        const isSSN = lowerKey.includes("ssn");

        return (
          <input
            type="text"
            inputMode="numeric"
            placeholder={field.placeholder || ""}
            required={field.required}
            value={dynamicFormData[field.fieldId] || ""}
            onChange={(e) => {
              let value = e.target.value;

              if (isPhone) {
                value = formatUSPhone(value);
              } else if (isSSN) {
                value = formatSSN(value);
              }
              handleDynamicFieldChange(field.fieldId, value);
            }}
            className={commonClasses}
          />
        );
      }

      case "DATE":
        return (
          <LoanDateField
            value={dynamicFormData[field.fieldId] || ""}
            onChange={(val) => handleDynamicFieldChange(field.fieldId, val)}
            className={commonClasses.replace(/^w-full\s+/, "")}
          />
        );

      case "SELECT":
        return (
          <select
            required={field.required}
            value={dynamicFormData[field.fieldId] || ""}
            onChange={(e) =>
              handleDynamicFieldChange(field.fieldId, e.target.value)
            }
            className={commonClasses}
          >
            <option value="">Select</option>
            {field.options?.map((opt: string, i: number) => (
              <option key={i} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );

      case "RADIO":
        return (
          <div
            className={`
      flex flex-wrap gap-6 mt-2 text-sm p-2 rounded-md border
      ${
        hasError
          ? "border-red-500 bg-red-50 dark:bg-red-900/20"
          : "border-slate-300 dark:border-slate-600"
      }
      bg-white dark:bg-slate-900
      text-slate-800 dark:text-slate-200
      `}
          >
            {field.options?.map((opt: string, i: number) => (
              <label key={i} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={field.fieldKey}
                  value={opt}
                  checked={dynamicFormData[field.fieldId] === opt}
                  onChange={() => handleDynamicFieldChange(field.fieldId, opt)}
                />
                {opt}
              </label>
            ))}
          </div>
        );

      case "CHECKBOX_GROUP":
        return (
          <div
            className={`
      flex flex-wrap gap-4 mt-2 text-sm p-2 rounded-md border
      ${
        hasError
          ? "border-red-500 bg-red-50 dark:bg-red-900/20"
          : "border-slate-300 dark:border-slate-600"
      }
      bg-white dark:bg-slate-900
      text-slate-800 dark:text-slate-200
      `}
          >
            {field.options?.map((opt: string, i: number) => (
              <label key={i} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  value={opt}
                  checked={
                    dynamicFormData[field.fieldId]?.includes(opt) || false
                  }
                  onChange={(e) => {
                    const prevValues = dynamicFormData[field.fieldId] || [];

                    if (e.target.checked) {
                      handleDynamicFieldChange(field.fieldId, [
                        ...prevValues,
                        opt,
                      ]);
                    } else {
                      handleDynamicFieldChange(
                        field.fieldId,
                        prevValues.filter((v: string) => v !== opt),
                      );
                    }
                  }}
                />
                {opt}
              </label>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  const goToStep = (stepIndex: number) => {
    setErrors({});
    setCurrentStep(stepIndex);

    if (stepIndex >= baseSteps.length) {
      setActiveSectionIndex(stepIndex - baseSteps.length);
    } else {
      setActiveSectionIndex(null);
    }
  };

  const handleStepClick = (index: number) => {
    if (index === currentStep) return;
    goToStep(index);
  };

  useEffect(() => {
    if (selectedProduct) {
      fetchSectionsByProduct();
    }
  }, [selectedProduct]);

  useEffect(() => {
    if (!isRentalPortfolioProduct(selectedProduct)) return;

    setFormData((prev) => {
      if (prev.financials.rentalProperty) return prev;

      return {
        ...prev,
        financials: {
          ...prev.financials,
          rentalProperty: true,
        },
      };
    });
  }, [selectedProduct]);

  useEffect(() => {
    if (!selectedCategory) return;

    const allowedProducts = CATEGORY_LOAN_TYPES[selectedCategory] || [];
    const catalogCodes = productsMeta.map((p: any) =>
      String(p.loanProductCode || ""),
    );

    const resolvedProducts = resolveCategoryLoanProducts(
      allowedProducts,
      catalogCodes,
    );

    // Prefer catalog matches; if none match category mapping, show category codes.
    setLoanProducts(
      resolvedProducts.length > 0 ? resolvedProducts : allowedProducts,
    );

    if (mode === "update" && initialSelectedProduct) {
      setSelectedProduct((prev) =>
        isProductAllowedInCategory(initialSelectedProduct, selectedCategory)
          ? initialSelectedProduct
          : prev,
      );
      return;
    }

    setSelectedProduct("");
  }, [selectedCategory, productsMeta, mode, initialSelectedProduct]);

  const updateBorrower = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      borrower: {
        ...prev.borrower,
        [field]: value,
      },
    }));

    // Live validation
    const fieldKey = `borrower.${field}`;
    const rule = getRuleForKey(fieldKey);
    if (rule) {
      const result = validateValue(value, rule);
      setErrors((prev) => {
        const updated = { ...prev };
        if (result.hasError) {
          updated[fieldKey] = result.error;
        } else {
          delete updated[fieldKey];
        }
        return updated;
      });
    } else {
      setErrors((prev) => {
        const updated = { ...prev };
        delete updated[fieldKey];
        return updated;
      });
    }
  };

  const updateCoBorrower = (index: number, field: string, value: string) => {
    setFormData((prev) => {
      const updated = [...prev.coBorrowers];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
      return { ...prev, coBorrowers: updated };
    });

    // Live validation - resolve indexed key to rule (e.g. "coBorrowers.0.name" → "coBorrower.name")
    const indexedKey = `coBorrowers.${index}.${field}`;
    const rule = getRuleForKey(indexedKey);
    if (rule) {
      const result = validateValue(value, rule);
      setErrors((prev) => {
        const updated = { ...prev };
        if (result.hasError) {
          updated[indexedKey] = result.error;
        } else {
          delete updated[indexedKey];
        }
        return updated;
      });
    } else {
      setErrors((prev) => {
        const updated = { ...prev };
        delete updated[indexedKey];
        return updated;
      });
    }
  };

  const updateBorrowerNested = <T extends Record<string, unknown>>(
    scope: "borrower" | "coBorrower",
    nestedKey: "assets" | "liabilities" | "declarations" | "realEstateOwned",
    field: string,
    value: unknown,
    coIndex?: number,
  ) => {
    setFormData((prev) => {
      if (scope === "borrower") {
        const current = prev.borrower[nestedKey] as unknown as T;
        return {
          ...prev,
          borrower: {
            ...prev.borrower,
            [nestedKey]:
              nestedKey === "realEstateOwned"
                ? (value as RealEstateOwnedEntry[])
                : { ...current, [field]: value },
          },
        };
      }

      const updated = [...prev.coBorrowers];
      const current = updated[coIndex!][nestedKey] as unknown as T;
      updated[coIndex!] = {
        ...updated[coIndex!],
        [nestedKey]:
          nestedKey === "realEstateOwned"
            ? (value as RealEstateOwnedEntry[])
            : { ...current, [field]: value },
      };
      return { ...prev, coBorrowers: updated };
    });

    if (nestedKey === "declarations") {
      const errorKey =
        scope === "borrower"
          ? `borrower.declarations.${field}`
          : `coBorrowers.${coIndex}.declarations.${field}`;

      setErrors((prev) => {
        const updated = { ...prev };
        delete updated[errorKey];
        return updated;
      });
    }
  };

  const updateBorrowerAmountField = (
    scope: "borrower" | "coBorrower",
    field: "totalCashReserves" | "existingDebt",
    rawValue: string,
    coIndex?: number,
  ) => {
    const cleaned = (rawValue ?? "").replace(/[^\d.]/g, "");
    const parts = cleaned.split(".");
    const normalized =
      parts.length > 1
        ? `${parts[0]}.${parts.slice(1).join("")}`
        : parts[0] || "";
    const formatted = normalized
      ? Number(normalized).toLocaleString("en-US")
      : "";

    if (scope === "borrower") {
      updateBorrower(field, formatted);
      return;
    }

    updateCoBorrower(coIndex!, field, formatted);
  };

  const addBorrowerProperty = (
    scope: "borrower" | "coBorrower",
    coIndex?: number,
  ) => {
    setFormData((prev) => {
      const property = createEmptyRealEstateProperty();
      if (scope === "borrower") {
        return {
          ...prev,
          borrower: {
            ...prev.borrower,
            realEstateOwned: [...prev.borrower.realEstateOwned, property],
          },
        };
      }

      const updated = [...prev.coBorrowers];
      updated[coIndex!] = {
        ...updated[coIndex!],
        realEstateOwned: [...updated[coIndex!].realEstateOwned, property],
      };
      return { ...prev, coBorrowers: updated };
    });
  };

  const removeBorrowerProperty = (
    scope: "borrower" | "coBorrower",
    propertyId: number,
    coIndex?: number,
  ) => {
    setFormData((prev) => {
      if (scope === "borrower") {
        return {
          ...prev,
          borrower: {
            ...prev.borrower,
            realEstateOwned: prev.borrower.realEstateOwned.filter(
              (entry) => entry.id !== propertyId,
            ),
          },
        };
      }

      const updated = [...prev.coBorrowers];
      updated[coIndex!] = {
        ...updated[coIndex!],
        realEstateOwned: updated[coIndex!].realEstateOwned.filter(
          (entry) => entry.id !== propertyId,
        ),
      };
      return { ...prev, coBorrowers: updated };
    });
  };

  const updateBorrowerProperty = (
    scope: "borrower" | "coBorrower",
    propertyId: number,
    field: keyof RealEstateOwnedEntry,
    value: string,
    coIndex?: number,
  ) => {
    setFormData((prev) => {
      const mapProperties = (entries: RealEstateOwnedEntry[]) =>
        entries.map((entry) =>
          entry.id === propertyId ? { ...entry, [field]: value } : entry,
        );

      if (scope === "borrower") {
        return {
          ...prev,
          borrower: {
            ...prev.borrower,
            realEstateOwned: mapProperties(prev.borrower.realEstateOwned),
          },
        };
      }

      const updated = [...prev.coBorrowers];
      updated[coIndex!] = {
        ...updated[coIndex!],
        realEstateOwned: mapProperties(updated[coIndex!].realEstateOwned),
      };
      return { ...prev, coBorrowers: updated };
    });

    // Live validation - field key uses property.${field} for rules lookup
    const fieldKey = `property.${String(field)}`;
    const rule = getRuleForKey(fieldKey);
    if (rule) {
      const result = validateValue(value, rule);
      // For properties inside co-borrowers, namespace the error
      const errorKey =
        scope === "borrower"
          ? `borrower.realEstateOwned.${propertyId}.${String(field)}`
          : `coBorrowers.${coIndex}.realEstateOwned.${propertyId}.${String(field)}`;
      setErrors((prev) => {
        const updated = { ...prev };
        if (result.hasError) {
          updated[errorKey] = result.error;
        } else {
          delete updated[errorKey];
        }
        return updated;
      });
    }
  };

  const updateBorrowerPropertyAmount = (
    scope: "borrower" | "coBorrower",
    propertyId: number,
    field: keyof RealEstateOwnedEntry,
    rawValue: string,
    coIndex?: number,
  ) => {
    const cleaned = (rawValue ?? "").replace(/[^\d.]/g, "");
    const parts = cleaned.split(".");
    const normalized =
      parts.length > 1
        ? `${parts[0]}.${parts.slice(1).join("")}`
        : parts[0] || "";
    const formatted = normalized
      ? Number(normalized).toLocaleString("en-US")
      : "";
    updateBorrowerProperty(scope, propertyId, field, formatted, coIndex);
  };

  const loanPurposeOptions = LOAN_PURPOSE_MAP[selectedProduct] || [];
  const topPurposeOptions = LOAN_TOP_PURPOSE_MAP[selectedProduct] || [];
  const subPurposeOptions = LOAN_SUB_PURPOSE_MAP[selectedProduct] || [];

  // For products that have a top-level purpose + sub-purpose split, use the
  // top-level list for the "Loan Purpose" dropdown and surface sub-purposes
  // in a separate "Sub-Loan Purpose" dropdown.
  const purposesToShow =
    topPurposeOptions.length > 0
      ? topPurposeOptions
      : loanPurposeOptions && loanPurposeOptions.length > 0
        ? loanPurposeOptions
        : ALL_LOAN_PURPOSES;

  const subPropertyOptions =
    PROPERTY_TYPE_MAP[formData.loanRequest.propertyType] || [];

  const categories: LoanCategory[] = [
    "RESIDENTIAL_1_4",
    "CRE_MULTIFAMILY",
    "SBA_USDA",
    "ABL",
  ];

  const CATEGORY_ICONS: Record<string, any> = {
    RESIDENTIAL_1_4: HomeIcon,
    CRE_MULTIFAMILY: Building2,
    SBA_USDA: Landmark,
    ABL: Settings,
  };

  const CATEGORY_LABELS: Record<string, string> = {
    RESIDENTIAL_1_4: "1-4 Units Residential",
    CRE_MULTIFAMILY: "CRE & Multifamily",
    SBA_USDA: "SBA & USDA",
    ABL: "Asset Based Lending",
  };

  const selectedProductLabel =
    PRODUCT_LABELS[selectedProduct] ||
    (selectedProduct ?? "").replace(/_/g, " ");

  const reviewValidationIssues = useMemo(
    () => getReviewValidationIssues(),
    [useStandardSevenStepFlow, selectedCategory, selectedProduct, formData],
  );

  const reviewSections = useMemo(
    () =>
      useStandardSevenStepFlow
        ? buildResidentialReviewSections({
            loanRequest: formData.loanRequest,
            entity: formData.entity,
            borrower: formData.borrower,
            financials: formData.financials,
            pendingDocuments,
            productLabel: selectedProductLabel,
            selectedProduct,
          })
        : [],
    [
      useStandardSevenStepFlow,
      formData.loanRequest,
      formData.entity,
      formData.borrower,
      formData.financials,
      pendingDocuments,
      selectedProductLabel,
      selectedProduct,
    ],
  );

  const isReviewStep =
    useStandardSevenStepFlow && currentStep === reviewStepIndex;

  const selectionBannerText =
    selectedCategory && selectedProduct
      ? formData.loanRequest.purpose?.trim()
        ? `${CATEGORY_LABELS[selectedCategory]} — ${selectedProductLabel} · ${formData.loanRequest.purpose.trim()}`
        : `${CATEGORY_LABELS[selectedCategory]} — ${selectedProductLabel}`
      : "";

  const showLoanRequestPurchaseDateReplacesAmortization =
    isLoanRequestPurchaseDateReplacesAmortization(
      selectedProduct,
      formData.loanRequest.purpose,
    );

  const showLoanRequestPurchaseDateWithAmortization =
    isPurchaseDateWithAmortization(
      selectedProduct,
      formData.loanRequest.purpose,
    );

  const loanRequestPurchaseDateLabel = getLoanRequestPurchaseDateLabel(
    selectedProduct,
    formData.loanRequest.purpose,
  );

  const showLoanRequestAmortization =
    !showLoanRequestPurchaseDateReplacesAmortization &&
    !hidesLoanRequestAmortization(
      selectedProduct,
      formData.loanRequest.purpose,
    );

  const showPropertyPurchaseDate = !shouldHidePropertyPurchaseDate(
    selectedProduct,
    formData.loanRequest.purpose,
  );

  return (
    <>
      <div
        className={
          embedded
            ? "bg-transparent"
            : "min-h-screen bg-slate-50 px-6 py-4 dark:bg-slate-900"
        }
      >
        {/* ===== FIXED HEADER SECTION ===== */}
        <div
          className={
            embedded
              ? "w-full pb-2"
              : "max-w-7xl mx-auto px-8 w-full sticky top-[1px] z-30 bg-slate-50 dark:bg-slate-900 pb-2"
          }
        >
          {/* HEADER */}
          <div className="mb-2">
            {/* BACK BUTTON */}
            {!embedded && (
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="
      mb-1 flex items-center gap-1.5
      text-xs font-medium text-slate-600
      hover:text-[#2C92D5]
      transition
    "
              >
                <IoArrowBack size={16} />
                {portalConfig.backLabel}
              </button>
            )}

            {/* TITLE */}
            {!embedded && (
              <div>
                <h2 className="text-xl font-bold leading-tight text-[#2C92D5]">
                  {mode === "update"
                    ? "Update Loan Application"
                    : "New Loan Application"}
                </h2>

                <p className="mt-0.5 text-xs text-slate-500">
                  {mode === "update"
                    ? "Review and update the submitted application details"
                    : "Complete all steps to submit your loan request for lender matching."}
                </p>
              </div>
            )}
          </div>
          {/* STEPPER */}
          <LoanApplicationStepper
            steps={allSteps}
            currentStep={currentStep}
            onStepClick={handleStepClick}
          />

          {/* STATS BOX */}
          <div
            className="
bg-blue-50 dark:bg-slate-800
border border-blue-200 dark:border-slate-700
rounded-2xl p-6 shadow-sm
"
          >
            {selectionBannerText && (
              <div className="mb-4 rounded-lg bg-[#2C92D5] px-4 py-2.5 text-center text-sm font-semibold text-white">
                {selectionBannerText}
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 text-center">
              <Stat label="Monthly Payment" value={monthlyPaymentDisplay} />
              <Stat label="LTV %" value={ltv !== "-" ? `${ltv}%` : "-"} />
              <Stat label="LTC %" value={ltc !== "-" ? `${ltc}%` : "-"} />
              <Stat label="ARV %" value={arv !== "-" ? `${arv}%` : "-"} />
              <Stat label="DSCR" value={dscr !== "-" ? dscr : "-"} />
              <Stat label="Net Worth" value={`$${netWorth.toLocaleString()}`} />
            </div>
          </div>
        </div>

        {/* Body */}
        <div className={embedded ? "w-full" : "max-w-7xl mx-auto px-8 w-full"}>
          {/* ================= STEP 0 ================= */}
          {currentStep === 0 && (
            <div className="mt-6 relative z-10 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 bg-white dark:bg-slate-800">
              <h3 className="text-lg font-semibold mb-6 dark:text-white">
                Step 1: Loan Request
              </h3>

              {/* ================= LOAN CATEGORY ================= */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-3">
                  Select a Loan Category <span className="text-red-500">*</span>
                </label>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {categories.map((category: LoanCategory) => {
                    const Icon = CATEGORY_ICONS[category] || Settings;

                    return (
                      <button
                        key={category}
                        type="button"
                        disabled={mode === "update"}
                        onClick={() => setSelectedCategory(category)}
                        className={`flex-shrink-0 flex flex-col items-center justify-center gap-1 
        w-full h-[76px] rounded-xl border transition-all text-center px-2 py-2
        disabled:cursor-not-allowed disabled:opacity-60
        
        ${
          selectedCategory === category
            ? "bg-[#2C92D5] text-white border-[#2C92D5] shadow-md"
            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:shadow-md"
        }`}
                      >
                        <Icon
                          size={20}
                          className={
                            selectedCategory === category
                              ? "text-white"
                              : "text-[#2C92D5]"
                          }
                        />

                        <span className="text-xs font-semibold leading-tight px-1">
                          {CATEGORY_LABELS[category] || category}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Product Code  */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Loan Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedProduct}
                    disabled={mode === "update" || !selectedCategory}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedProduct(val);
                      // Live validate selectedProduct
                      const rule = getRuleForKey("loanRequest.selectedProduct");
                      if (rule) {
                        const result = validateValue(val, rule);
                        setErrors((prev) => {
                          const updated = { ...prev };
                          if (result.hasError) {
                            updated["selectedProduct"] = result.error;
                          } else {
                            delete updated["selectedProduct"];
                          }
                          return updated;
                        });
                      }
                      updateLoanRequest("purpose", "");
                      updateLoanRequest("subPurpose", "");
                      updateLoanRequest("collateralType", "");
                      updateLoanRequest("additionalCollateral", []);
                      updateLoanRequest("privateSale", false);
                      updateLoanRequest("vendorName", "");
                      updateLoanRequest("vendorPhone", "");
                      setDynamicSections([]);
                      setActiveSectionIndex(null);
                    }}
                    className={`w-full px-4 py-1 rounded-md border
border-slate-300 dark:border-slate-600
bg-white dark:bg-slate-900
text-slate-800 dark:text-slate-200
focus:ring-2 focus:ring-blue-500/20
focus:border-blue-500 outline-none text-sm disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-slate-100 dark:disabled:bg-slate-800 ${
                      errors["selectedProduct"]
                        ? "border-red-500 bg-red-50"
                        : "border-slate-300"
                    }
  bg-white focus:ring-2 focus:ring-blue-500/20 
  focus:border-blue-500 outline-none transition text-sm`}
                  >
                    <option value="">
                      {selectedCategory
                        ? "Select loan type"
                        : "Select a loan category first"}
                    </option>

                    {loadingProducts ? (
                      <option disabled>Loading...</option>
                    ) : (
                      loanProducts.map((code) => (
                        <option key={code} value={code}>
                          {PRODUCT_LABELS[code] || code.replace(/_/g, " ")}
                        </option>
                      ))
                    )}
                  </select>
                  {errors["selectedProduct"] && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors["selectedProduct"]}
                    </p>
                  )}
                </div>

                {selectedProduct && (
                  <>
                    {/* Loan Purpose */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                        Loan Purpose <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.loanRequest.purpose}
                        onChange={(e) => {
                          const purpose = e.target.value;
                          updateLoanRequest("purpose", purpose);
                          updateLoanRequest("subPurpose", "");
                          if (
                            isLoanRequestPurchaseDateReplacesAmortization(
                              selectedProduct,
                              purpose,
                            ) ||
                            hidesLoanRequestAmortization(
                              selectedProduct,
                              purpose,
                            )
                          ) {
                            updateLoanRequest("amortization", "");
                          }
                          if (
                            hidesLoanRequestAmortization(
                              selectedProduct,
                              purpose,
                            ) ||
                            isCrePermanentRecapitalization(
                              selectedProduct,
                              purpose,
                            ) ||
                            isAgencyMultifamilyNoPurchaseDate(
                              selectedProduct,
                              purpose,
                            )
                          ) {
                            updateLoanRequest("purchaseDate", "");
                          }
                        }}
                        className={`w-full px-4 py-1 rounded-md border
border-slate-300 dark:border-slate-600
bg-white dark:bg-slate-900
text-slate-800 dark:text-slate-200
focus:ring-2 focus:ring-blue-500/20
focus:border-blue-500 outline-none text-sm ${
                          errors["loanRequest.purpose"]
                            ? "border-red-500 bg-red-50"
                            : "border-slate-300"
                        }`}
                      >
                        <option value="">Select purpose</option>
                        {purposesToShow.map((purpose) => (
                          <option key={purpose} value={purpose}>
                            {purpose}
                          </option>
                        ))}
                      </select>
                      {errors["loanRequest.purpose"] && (
                        <p className="text-xs text-red-500 mt-1">
                          {errors["loanRequest.purpose"]}
                        </p>
                      )}
                    </div>
                    {/* Sub-Loan Purpose - shown only when the selected product has a
                        top-level/sub-purpose split CONSTRUCTION_LOAN_1_TO_4_UNITS & MEZZANINE_FINANCE. */}
                    {subPurposeOptions.length > 0 && (
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                          Sub-Loan Purpose{" "}
                          <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={formData.loanRequest.subPurpose}
                          onChange={(e) =>
                            updateLoanRequest("subPurpose", e.target.value)
                          }
                          className={`w-full px-4 py-1 rounded-md border
border-slate-300 dark:border-slate-600
bg-white dark:bg-slate-900
text-slate-800 dark:text-slate-200
focus:ring-2 focus:ring-blue-500/20
focus:border-blue-500 outline-none text-sm ${
                            errors["loanRequest.subPurpose"]
                              ? "border-red-500 bg-red-50"
                              : "border-slate-300"
                          }`}
                        >
                          <option value="">Select sub-purpose</option>
                          {subPurposeOptions.map((sub) => (
                            <option key={sub} value={sub}>
                              {sub}
                            </option>
                          ))}
                        </select>
                        {errors["loanRequest.subPurpose"] && (
                          <p className="text-xs text-red-500 mt-1">
                            {errors["loanRequest.subPurpose"]}
                          </p>
                        )}
                      </div>
                    )}
                    {/* Seller Financing */}
                    <div
                      className={`md:col-span-2 ${
                        formData.loanRequest.sellerFinancing === "yes"
                          ? "grid grid-cols-1 md:grid-cols-2 gap-4 items-end"
                          : ""
                      }`}
                    >
                      <div className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-3">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                          Seller Financing?
                        </span>

                        <button
                          type="button"
                          role="switch"
                          aria-checked={
                            formData.loanRequest.sellerFinancing === "yes"
                          }
                          onClick={() => {
                            const enabling =
                              formData.loanRequest.sellerFinancing !== "yes";
                            updateLoanRequest(
                              "sellerFinancing",
                              enabling ? "yes" : "no",
                            );

                            if (!enabling) {
                              updateLoanRequest("sellerNoteAmount", "");
                            }
                          }}
                          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition ${
                            formData.loanRequest.sellerFinancing === "yes"
                              ? "bg-[#2C92D5]"
                              : "bg-slate-200 dark:bg-slate-700"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                              formData.loanRequest.sellerFinancing === "yes"
                                ? "translate-x-5"
                                : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>

                      {formData.loanRequest.sellerFinancing === "yes" && (
                        <div>
                          <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                            Seller Note Amount ($)
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                              $
                            </span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={formData.loanRequest.sellerNoteAmount}
                              onChange={(e) => {
                                const formatted = formatCurrency(
                                  e.target.value,
                                );
                                updateLoanRequest(
                                  "sellerNoteAmount",
                                  formatted,
                                );
                              }}
                              placeholder="0"
                              className="w-full pl-7 pr-4 py-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Requested Loan Amount */}
                    <div>
                      <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                        Requested Loan Amount ($){" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                          $
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formData.loanRequest.amount}
                          onChange={(e) => {
                            const formatted = formatCurrency(e.target.value);
                            updateLoanRequest("amount", formatted);
                          }}
                          placeholder="0"
                          className={`w-full pl-7 pr-4 py-1 rounded-md border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${
                            errors["loanRequest.amount"]
                              ? "border-red-500 bg-red-50"
                              : "border-slate-300"
                          } focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm`}
                        />
                      </div>
                      {errors["loanRequest.amount"] && (
                        <p className="text-xs text-red-500 mt-1">
                          {errors["loanRequest.amount"]}
                        </p>
                      )}
                    </div>
                    {/* Estimated Closing Date */}
                    <div>
                      <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                        Estimated Closing Date
                      </label>
                      <LoanDateField
                        disablePastDates
                        value={formData.loanRequest.estimatedClosingDate}
                        onChange={(val) =>
                          updateLoanRequest("estimatedClosingDate", val)
                        }
                      />
                    </div>
                    {/* Expected Interest Rate */}
                    <div>
                      <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                        Expected Interest Rate (%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.loanRequest.interestRate}
                        onChange={(e) =>
                          updateLoanRequest("interestRate", e.target.value)
                        }
                        placeholder="e.g. 7.5"
                        className={`w-full px-4 py-1 rounded-md border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${
                          errors["loanRequest.brokerPoints"]
                            ? "border-red-500 bg-red-50"
                            : "border-slate-300"
                        } focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm`}
                      />
                      {errors["loanRequest.interestRate"] && (
                        <p className="text-xs text-red-500 mt-1">
                          {errors["loanRequest.interestRate"]}
                        </p>
                      )}
                    </div>
                    {/* Recourse */}
                    <div>
                      <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                        Recourse
                      </label>
                      <select
                        value={formData.loanRequest.recourse}
                        onChange={(e) =>
                          updateLoanRequest("recourse", e.target.value)
                        }
                        className="w-full px-4 py-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                      >
                        <option value="">Select</option>
                        <option value="FULL_RECOURSE">Full Recourse</option>
                        <option value="NON_RECOURSE">Non-Recourse</option>
                        <option value="LIMITED_RECOURSE">
                          Limited Recourse
                        </option>
                      </select>
                    </div>
                    {/* Loan Term — hidden when rate type is Interest Only */}
                    {formData.loanRequest.rateType !== "INTEREST_ONLY" && (
                      <div>
                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                          Loan Term (in Months)
                        </label>
                        <input
                          type="number"
                          value={formData.loanTermIncome.loanTerm}
                          onChange={(e) =>
                            updateLoanTermIncome("loanTerm", e.target.value)
                          }
                          placeholder="e.g. 12"
                          className={`w-full px-4 py-1 rounded-md border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${
                            errors["loanTermIncome.loanTerm"]
                              ? "border-red-500 bg-red-50"
                              : "border-slate-300"
                          } focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm`}
                        />
                        {errors["loanTermIncome.loanTerm"] && (
                          <p className="text-xs text-red-500 mt-1">
                            {errors["loanTermIncome.loanTerm"]}
                          </p>
                        )}
                      </div>
                    )}
                    {/* Rate Type */}
                    <div>
                      <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                        Rate Type
                      </label>
                      <select
                        value={formData.loanRequest.rateType}
                        onChange={(e) =>
                          updateLoanRequest("rateType", e.target.value)
                        }
                        className="w-full px-4 py-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                      >
                        <option value="INTEREST_ONLY">Interest Only</option>
                        <option value="FIXED">Fixed</option>
                        <option value="VARIABLE">Variable</option>
                        <option value="HYBRID">Hybrid</option>
                      </select>
                    </div>
                    {/* Broker Points */}
                    <div>
                      <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                        Broker Points (%){" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.loanRequest.brokerPoints}
                        onChange={(e) =>
                          updateLoanRequest("brokerPoints", e.target.value)
                        }
                        placeholder="e.g. 1.0"
                        className={`w-full px-4 py-1 rounded-md border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${
                          errors["loanRequest.brokerPoints"]
                            ? "border-red-500 bg-red-50"
                            : "border-slate-300"
                        } focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm`}
                      />
                      {errors["loanRequest.brokerPoints"] && (
                        <p className="text-xs text-red-500 mt-1">
                          {errors["loanRequest.brokerPoints"]}
                        </p>
                      )}
                    </div>
                    {/* Amortization / purchase date (replaces amortization slot) */}
                    {showLoanRequestPurchaseDateReplacesAmortization ? (
                      <div>
                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                          {loanRequestPurchaseDateLabel}
                        </label>
                        <LoanDateField
                          value={formData.loanRequest.purchaseDate}
                          onChange={(val) =>
                            updateLoanRequest("purchaseDate", val)
                          }
                          className={
                            errors["loanRequest.purchaseDate"]
                              ? "border-red-500 bg-red-50"
                              : ""
                          }
                        />
                        {errors["loanRequest.purchaseDate"] && (
                          <p className="text-xs text-red-500 mt-1">
                            {errors["loanRequest.purchaseDate"]}
                          </p>
                        )}
                      </div>
                    ) : showLoanRequestAmortization ? (
                      <div>
                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                          Amortization (in Years)
                        </label>
                        <input
                          type="number"
                          value={formData.loanRequest.amortization}
                          onChange={(e) =>
                            updateLoanRequest("amortization", e.target.value)
                          }
                          placeholder="e.g. 30"
                          className="w-full px-4 py-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                        />
                      </div>
                    ) : null}
                    {showLoanRequestPurchaseDateWithAmortization && (
                      <div>
                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                          {loanRequestPurchaseDateLabel}
                        </label>
                        <LoanDateField
                          value={formData.loanRequest.purchaseDate}
                          onChange={(val) =>
                            updateLoanRequest("purchaseDate", val)
                          }
                          className={
                            errors["loanRequest.purchaseDate"]
                              ? "border-red-500 bg-red-50"
                              : ""
                          }
                        />
                        {errors["loanRequest.purchaseDate"] && (
                          <p className="text-xs text-red-500 mt-1">
                            {errors["loanRequest.purchaseDate"]}
                          </p>
                        )}
                      </div>
                    )}
                    {/* Purchase, Equity, & Costs (Fix & Flip, 1-4 Unit Residential only) */}
                    {showEquityDownPaymentBlock(
                      selectedProduct,
                      formData.loanRequest.purpose,
                      selectedCategory,
                    ) && (
                      <div className="md:col-span-2 mt-2 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          Purchase, Equity, &amp; Costs
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          Total Project Cost = Purchase Price + Rehab Cost. Loan
                          Amount + Down Payment + Seller Financing must equal
                          the Purchase Price.
                        </p>

                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                              Purchase Price ($){" "}
                              <span className="text-red-500">*</span>
                            </label>
                            <div className="relative mt-1">
                              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                                $
                              </span>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={formData.loanRequest.purchasePrice}
                                onChange={(e) =>
                                  handleAmountChange(
                                    "loanRequest",
                                    "purchasePrice",
                                    e.target.value,
                                  )
                                }
                                placeholder="0"
                                className={`w-full rounded-md border py-1 pl-7 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${
                                  errors["loanRequest.purchasePrice"] ||
                                  equityMismatchError
                                    ? "border-red-500 bg-red-50"
                                    : "border-slate-300"
                                }`}
                              />
                            </div>
                            {errors["loanRequest.purchasePrice"] && (
                              <p className="mt-1 text-xs text-red-500">
                                {errors["loanRequest.purchasePrice"]}
                              </p>
                            )}
                          </div>

                          <div>
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                              Down Payment ($){" "}
                              <span className="text-red-500">*</span>
                            </label>
                            <div className="relative mt-1">
                              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                                $
                              </span>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={formData.loanRequest.downPayment}
                                onChange={(e) =>
                                  handleAmountChange(
                                    "loanRequest",
                                    "downPayment",
                                    e.target.value,
                                  )
                                }
                                placeholder="0"
                                className={`w-full rounded-md border py-1 pl-7 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${
                                  errors["loanRequest.downPayment"] ||
                                  equityMismatchError
                                    ? "border-red-500 bg-red-50"
                                    : "border-slate-300"
                                }`}
                              />
                            </div>
                            {errors["loanRequest.downPayment"] && (
                              <p className="mt-1 text-xs text-red-500">
                                {errors["loanRequest.downPayment"]}
                              </p>
                            )}
                          </div>
                        </div>

                        {isFixAndFlipProduct(selectedProduct) ||
                          (isConstructionPurchase(
                            formData.loanRequest.purpose,
                            selectedProduct,
                          ) && (
                            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                                  {showConstructionCostLable(selectedProduct)
                                    ? "Construction Cost"
                                    : "Rehab Cost"}{" "}
                                  ($)
                                </label>
                                <div className="relative mt-1">
                                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                                    $
                                  </span>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={
                                      showConstructionCostLable(selectedProduct)
                                        ? formData.loanRequest.constructionCost
                                        : formData.loanRequest.rehabCost
                                    }
                                    onChange={(e) =>
                                      handleAmountChange(
                                        "loanRequest",
                                        showConstructionCostLable(
                                          selectedProduct,
                                        )
                                          ? "constructionCost"
                                          : "rehabCost",
                                        e.target.value,
                                      )
                                    }
                                    placeholder="0"
                                    className={`w-full rounded-md border py-1 pl-7 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${
                                      errors["loanRequest.rehabCost"]
                                        ? "border-red-500 bg-red-50"
                                        : "border-slate-300"
                                    }`}
                                  />
                                </div>
                                {errors["loanRequest.rehabCost"] && (
                                  <p className="mt-1 text-xs text-red-500">
                                    {errors["loanRequest.rehabCost"]}
                                  </p>
                                )}
                              </div>

                              <div>
                                <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                                  After Repair Value (ARV) ($)
                                </label>
                                <div className="relative mt-1">
                                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                                    $
                                  </span>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={
                                      formData.loanRequest.afterRepairValue
                                    }
                                    onChange={(e) =>
                                      handleAmountChange(
                                        "loanRequest",
                                        "afterRepairValue",
                                        e.target.value,
                                      )
                                    }
                                    placeholder="0"
                                    className={`w-full rounded-md border py-1 pl-7 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${
                                      errors["loanRequest.afterRepairValue"]
                                        ? "border-red-500 bg-red-50"
                                        : "border-slate-300"
                                    }`}
                                  />
                                </div>
                                {errors["loanRequest.afterRepairValue"] && (
                                  <p className="mt-1 text-xs text-red-500">
                                    {errors["loanRequest.afterRepairValue"]}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}

                        {isFixAndFlipProduct(selectedProduct) && (
                          <div className="mt-3 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-3 text-xs text-slate-600 dark:text-slate-300">
                            <span className="font-semibold">
                              Total Project Cost (Auto):
                            </span>{" "}
                            ${totalFlipCost.toLocaleString()} &nbsp;|&nbsp;
                            Purchase Price: $
                            {purchasePriceTotal.toLocaleString()} + Rehab Cost:
                            ${rehabCost.toLocaleString()}
                          </div>
                        )}

                        <div
                          className={`mt-3 rounded-md border p-3 text-xs ${
                            !hasPurchasePrice
                              ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
                              : equityMismatchError
                                ? "border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300"
                                : "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
                          }`}
                        >
                          <div>
                            Loan Amount: ${loanAmountTotal.toLocaleString()} +
                            Down Payment: ${downPaymentTotal.toLocaleString()}{" "}
                            {hasSellerFinancing
                              ? `+ Seller Financing: $${sellerFinancingTotal.toLocaleString()}`
                              : ""}{" "}
                            = ${equityGrandTotal.toLocaleString()}
                          </div>
                          {!hasPurchasePrice ? (
                            <div className="mt-1">
                              Enter a Purchase Price to validate.
                            </div>
                          ) : equityMismatchError ? (
                            <div className="mt-1">
                              Total must equal the Purchase Price ($
                              {purchasePriceTotal.toLocaleString()}).
                            </div>
                          ) : (
                            <div className="mt-1">
                              Total matches Purchase Price.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {/* Valuation & Equity */}
                    {showValuationEquityBlock(
                      selectedProduct,
                      formData.loanRequest.purpose,
                    ) && (
                      <div className="md:col-span-2 mt-2 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          Valuation & Equity
                        </p>

                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                              Current As-Is Property Value ($)
                            </label>
                            <div className="relative mt-1">
                              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                                $
                              </span>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={
                                  formData.loanRequest.currentMarketValue || ""
                                }
                                onChange={(e) =>
                                  handleAmountChange(
                                    "loanRequest",
                                    "currentMarketValue",
                                    e.target.value,
                                  )
                                }
                                placeholder="0"
                                className="w-full rounded-md border border-slate-300 py-1 pl-7 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                              Current Loan Balance ($)
                            </label>
                            <div className="relative mt-1">
                              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                                $
                              </span>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={
                                  formData.loanRequest.currentLoanBalance || ""
                                }
                                onChange={(e) =>
                                  handleAmountChange(
                                    "loanRequest",
                                    "currentLoanBalance",
                                    e.target.value,
                                  )
                                }
                                placeholder="0"
                                className="w-full rounded-md border border-slate-300 py-1 pl-7 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-3 text-xs text-slate-600 dark:text-slate-300">
                          <span className="font-semibold">Equity (Auto):</span>{" "}
                          $
                          {Math.max(
                            (Number(
                              formData.loanRequest.currentMarketValue || 0,
                            ) || 0) -
                              (Number(
                                formData.loanRequest.currentLoanBalance || 0,
                              ) || 0),
                            0,
                          ).toLocaleString()}{" "}
                          &nbsp;|&nbsp; Current As-Is Value: $
                          {(
                            Number(
                              formData.loanRequest.currentMarketValue || 0,
                            ) || 0
                          ).toLocaleString()}{" "}
                          – Current Loan Balance: $
                          {(
                            Number(
                              formData.loanRequest.currentLoanBalance || 0,
                            ) || 0
                          ).toLocaleString()}
                        </div>
                      </div>
                    )}

                    {/* Valuation, Costs & Equity */}
                    {showValuationCostEquity(
                      selectedProduct,
                      formData.loanRequest.purpose,
                    ) && (
                      <div className="md:col-span-2 mt-2 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          Valuation, Costs & Equity
                        </p>

                        {/* Row 1: As-Is Value + Loan Balance */}
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                              Current As-Is Property Value ($)
                            </label>
                            <div className="relative mt-1">
                              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                                $
                              </span>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={
                                  formData.loanRequest.currentMarketValue || ""
                                }
                                onChange={(e) =>
                                  handleAmountChange(
                                    "loanRequest",
                                    "currentMarketValue",
                                    e.target.value,
                                  )
                                }
                                placeholder="0"
                                className="w-full rounded-md border border-slate-300 py-1 pl-7 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                              Current Loan Balance ($)
                            </label>
                            <div className="relative mt-1">
                              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                                $
                              </span>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={
                                  formData.loanRequest.currentLoanBalance || ""
                                }
                                onChange={(e) =>
                                  handleAmountChange(
                                    "loanRequest",
                                    "currentLoanBalance",
                                    e.target.value,
                                  )
                                }
                                placeholder="0"
                                className="w-full rounded-md border border-slate-300 py-1 pl-7 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Equity Auto Summary */}
                        <div className="mt-3 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-3 text-xs text-slate-600 dark:text-slate-300">
                          <span className="font-semibold">Equity (Auto):</span>{" "}
                          $
                          {Math.max(
                            (Number(
                              formData.loanRequest.currentMarketValue || 0,
                            ) || 0) -
                              (Number(
                                formData.loanRequest.currentLoanBalance || 0,
                              ) || 0),
                            0,
                          ).toLocaleString()}{" "}
                          &nbsp;|&nbsp; Current As-Is Value: $
                          {(
                            Number(
                              formData.loanRequest.currentMarketValue || 0,
                            ) || 0
                          ).toLocaleString()}{" "}
                          – Current Loan Balance: $
                          {(
                            Number(
                              formData.loanRequest.currentLoanBalance || 0,
                            ) || 0
                          ).toLocaleString()}
                        </div>

                        {/* Row 2: Rehab Cost + ARV */}
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                              {showConstructionCostLable(selectedProduct)
                                ? "Construction Cost"
                                : "Rehab Cost"}
                            </label>
                            <div className="relative mt-1">
                              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                                $
                              </span>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={
                                  showConstructionCostLable(selectedProduct)
                                    ? formData.loanRequest.constructionCost
                                    : formData.loanRequest.rehabCost
                                }
                                onChange={(e) =>
                                  handleAmountChange(
                                    "loanRequest",
                                    showConstructionCostLable(selectedProduct)
                                      ? "constructionCost"
                                      : "rehabCost",
                                    e.target.value,
                                  )
                                }
                                placeholder="0"
                                className="w-full rounded-md border border-slate-300 py-1 pl-7 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                              After Repair Value (ARV) ($)
                            </label>
                            <div className="relative mt-1">
                              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                                $
                              </span>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={
                                  formData.loanRequest.afterRepairValue || ""
                                }
                                onChange={(e) =>
                                  handleAmountChange(
                                    "loanRequest",
                                    "afterRepairValue",
                                    e.target.value,
                                  )
                                }
                                placeholder="0"
                                className="w-full rounded-md border border-slate-300 py-1 pl-7 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Total Project Cost Auto Summary */}
                        <div className="mt-3 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-3 text-xs text-slate-600 dark:text-slate-300">
                          <span className="font-semibold">
                            Total Project Cost (Auto):
                          </span>{" "}
                          $
                          {(
                            (Number(
                              formData.loanRequest.currentMarketValue || 0,
                            ) || 0) +
                            (Number(formData.loanRequest.rehabCost || 0) || 0)
                          ).toLocaleString()}{" "}
                          &nbsp;|&nbsp; Current As-Is Value: $
                          {(
                            Number(
                              formData.loanRequest.currentMarketValue || 0,
                            ) || 0
                          ).toLocaleString()}{" "}
                          + Rehab Cost: $
                          {(
                            Number(formData.loanRequest.rehabCost || 0) || 0
                          ).toLocaleString()}
                        </div>
                      </div>
                    )}
                    {/* Use of Funds */}
                    <div className="md:col-span-2 mt-2">
                      <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        Use of Funds
                      </label>
                      <textarea
                        value={formData.loanRequest.useOfFunds}
                        onChange={(e) =>
                          updateLoanRequest("useOfFunds", e.target.value)
                        }
                        rows={4}
                        placeholder="Describe how the loan funds will be used (e.g., acquisition cost, rehab, closing costs, reserves)..."
                        className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 px-4 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                    {/* Exit Strategy */}
                    {showExitStrategy(selectedProduct, selectedCategory) && (
                      <div className="md:col-span-2 mt-2">
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                          Exit Strategy
                        </label>
                        <textarea
                          value={formData.loanRequest.exitStrategy}
                          onChange={(e) =>
                            updateLoanRequest("exitStrategy", e.target.value)
                          }
                          rows={4}
                          placeholder="Describe how you plan to repay or refinance this loan..."
                          className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 px-4 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* step-1 — Entity Info */}
          {currentStep === 1 && (
            <div className="mt-6 relative z-10 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 bg-white dark:bg-slate-800">
              <h3 className="mb-1 inline-block border-b-2 border-[#2C92D5] pb-2 text-lg font-semibold dark:text-white">
                Step 2: Entity Info
              </h3>

              <p className="mb-5 mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Business / Entity Information
              </p>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    Legal Business / Entity Name{" "}
                    <span className="text-red-500">*</span>
                  </label>

                  <input
                    value={formData.entity.legalName}
                    onChange={(e) => updateEntity("legalName", e.target.value)}
                    placeholder="ABC Holdings LLC"
                    className={`mt-1 w-full rounded-md border px-4 py-1 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${
                      errors["entity.legalName"]
                        ? "border-red-500 bg-red-50"
                        : "border-slate-300"
                    }`}
                  />

                  {errors["entity.legalName"] && (
                    <p className="mt-1 text-xs text-red-500">
                      {errors["entity.legalName"]}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    Entity Type <span className="text-red-500">*</span>
                  </label>

                  <select
                    value={formData.entity.entityType}
                    onChange={(e) => updateEntity("entityType", e.target.value)}
                    className={`mt-1 w-full rounded-md border px-4 py-1 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${
                      errors["entity.entityType"]
                        ? "border-red-500 bg-red-50"
                        : "border-slate-300"
                    }`}
                  >
                    <option value="">Select</option>
                    {ENTITY_TYPE_OPTIONS.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>

                  {errors["entity.entityType"] && (
                    <p className="mt-1 text-xs text-red-500">
                      {errors["entity.entityType"]}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    DBA (if applicable)
                  </label>

                  <input
                    value={formData.entity.dba}
                    onChange={(e) => updateEntity("dba", e.target.value)}
                    placeholder="Doing Business As..."
                    className="mt-1 w-full rounded-md border border-slate-300 px-4 py-1 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    Entity Formation Date{" "}
                    <span className="text-red-500">*</span>
                  </label>

                  <LoanDateField
                    value={formData.entity.formationDate}
                    onChange={(val) => updateEntity("formationDate", val)}
                    className={`mt-1 ${
                      errors["entity.formationDate"]
                        ? "border-red-500 bg-red-50"
                        : ""
                    }`}
                  />

                  {errors["entity.formationDate"] && (
                    <p className="mt-1 text-xs text-red-500">
                      {errors["entity.formationDate"]}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    Years in Business <span className="text-red-500">*</span>
                  </label>

                  <input
                    type="number"
                    min={0}
                    value={formData.entity.yearsInBusiness}
                    onChange={(e) =>
                      updateEntity("yearsInBusiness", e.target.value)
                    }
                    placeholder="0"
                    className={`mt-1 w-full rounded-md border px-4 py-1 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${
                      errors["entity.yearsInBusiness"]
                        ? "border-red-500 bg-red-50"
                        : "border-slate-300"
                    }`}
                  />

                  {errors["entity.yearsInBusiness"] && (
                    <p className="mt-1 text-xs text-red-500">
                      {errors["entity.yearsInBusiness"]}
                    </p>
                  )}
                </div>
              </div>

              {!showDefaultEntityInfoFields && isSba7aBase44Flow && (
                <Sba7aEntityFields
                  entity={formData.entity}
                  financials={formData.financials}
                  onEntityChange={updateEntity}
                  onFinancialsChange={updateFinancials}
                  errors={errors}
                  formatCurrency={formatCurrency}
                />
              )}

              {!showDefaultEntityInfoFields && isAblBase44Flow && (
                <AblEntityFields
                  ebitdaWithNoi={formData.entity.ebitdaWithNoi}
                  financials={formData.financials}
                  onEbitdaChange={(value) =>
                    updateEntity("ebitdaWithNoi", value)
                  }
                  onFinancialsChange={updateFinancials}
                  formatCurrency={formatCurrency}
                />
              )}

              {!showDefaultEntityInfoFields &&
                isCreBase44Flow &&
                showCreBase44EntityEbitda(selectedProduct) && (
                  <>
                    <p className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      EBITDA / NOI
                    </p>

                    <div className="max-w-md">
                      <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        EBITDA with NOI ($)
                      </label>

                      <div className="relative mt-1">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                          $
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formData.entity.ebitdaWithNoi}
                          onChange={(e) =>
                            updateEntity(
                              "ebitdaWithNoi",
                              formatCurrency(e.target.value),
                            )
                          }
                          placeholder="0"
                          className="w-full rounded-md border border-slate-300 py-1 pl-7 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                        />
                      </div>
                    </div>
                  </>
                )}
            </div>
          )}

          {/* step-2 — Property Info / Collateral Info */}
          {currentStep === 2 && (
            <div className="mt-6 relative z-10 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 bg-white dark:bg-slate-800">
              <div className="mb-1 flex items-center gap-2">
                <h3 className="inline-block border-b-2 border-[#2C92D5] pb-2 text-lg font-semibold dark:text-white">
                  Step 3:{" "}
                  {selectedCategory === "SBA_USDA" || selectedCategory === "ABL"
                    ? "Collateral Info"
                    : "Property Info"}
                </h3>
                {selectedCategory &&
                  (selectedCategory === "SBA_USDA" ||
                    selectedCategory === "ABL") && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#2C92D5]/30 bg-blue-50 px-2.5 py-1 text-xs font-medium text-[#2C92D5] dark:bg-blue-900/30">
                      {(() => {
                        const Icon = CATEGORY_ICONS[selectedCategory];
                        return Icon ? <Icon className="h-3.5 w-3.5" /> : null;
                      })()}
                      {CATEGORY_LABELS[selectedCategory]}
                    </span>
                  )}
              </div>

              {showDefaultPropertyInfoFields ? (
                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      Property Address <span className="text-red-500">*</span>
                    </label>

                    <input
                      value={formData.loanRequest.businessAddress}
                      onChange={(e) =>
                        updateLoanRequest("businessAddress", e.target.value)
                      }
                      placeholder="123 Main Street"
                      className={`mt-1 w-full rounded-md border px-4 py-1 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${
                        errors["loanRequest.businessAddress"]
                          ? "border-red-500 bg-red-50"
                          : "border-slate-300"
                      }`}
                    />

                    {errors["loanRequest.businessAddress"] && (
                      <p className="mt-1 text-xs text-red-500">
                        {errors["loanRequest.businessAddress"]}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      City <span className="text-red-500">*</span>
                    </label>

                    <input
                      value={formData.loanRequest.city}
                      onChange={(e) =>
                        updateLoanRequest("city", e.target.value)
                      }
                      className={`mt-1 w-full rounded-md border px-4 py-1 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${
                        errors["loanRequest.city"]
                          ? "border-red-500 bg-red-50"
                          : "border-slate-300"
                      }`}
                    />

                    {errors["loanRequest.city"] && (
                      <p className="mt-1 text-xs text-red-500">
                        {errors["loanRequest.city"]}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      State <span className="text-red-500">*</span>
                    </label>

                    <select
                      value={formData.loanRequest.state}
                      onChange={(e) =>
                        updateLoanRequest("state", e.target.value)
                      }
                      className={`mt-1 w-full rounded-md border px-4 py-1 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${
                        errors["loanRequest.state"]
                          ? "border-red-500 bg-red-50"
                          : "border-slate-300"
                      }`}
                    >
                      <option value="">Select state</option>
                      {US_STATES.map((state) => (
                        <option key={state} value={state}>
                          {state}
                        </option>
                      ))}
                    </select>

                    {errors["loanRequest.state"] && (
                      <p className="mt-1 text-xs text-red-500">
                        {errors["loanRequest.state"]}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      ZIP <span className="text-red-500">*</span>
                    </label>

                    <input
                      type="text"
                      inputMode="numeric"
                      value={formData.loanRequest.zip}
                      onChange={(e) => {
                        const value = e.target.value
                          .replace(/[^\d-]/g, "")
                          .slice(0, 10);
                        updateLoanRequest("zip", value);
                      }}
                      className={`mt-1 w-full rounded-md border px-4 py-1 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${
                        errors["loanRequest.zip"]
                          ? "border-red-500 bg-red-50"
                          : "border-slate-300"
                      }`}
                    />

                    {errors["loanRequest.zip"] && (
                      <p className="mt-1 text-xs text-red-500">
                        {errors["loanRequest.zip"]}
                      </p>
                    )}
                  </div>

                  <div>
                    {errors["loanRequest.purchasePrice"] && (
                      <p className="mt-1 text-xs text-red-500">
                        {errors["loanRequest.purchasePrice"]}
                      </p>
                    )}
                  </div>
                </div>
              ) : isBase44CollateralStep ? (
                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {isSbaUsdaCollateralFlow || isAblCollateralFlow ? (
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        {isAblCollateralFlow
                          ? "Business / Industry Type"
                          : getSbaCollateralTypeLabel(selectedProduct) ||
                            "Business / Industry Type"}{" "}
                        <span className="text-red-500">*</span>
                      </label>

                      <select
                        value={formData.loanRequest.collateralType}
                        onChange={(e) =>
                          updateLoanRequest("collateralType", e.target.value)
                        }
                        className={`mt-1 w-full appearance-none rounded-md border bg-white px-4 py-2 text-sm leading-snug outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${
                          errors["loanRequest.collateralType"]
                            ? "border-red-500 bg-red-50"
                            : "border-slate-300"
                        }`}
                        style={{
                          backgroundImage:
                            "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%2364748b'%3E%3Cpath fill-rule='evenodd' d='M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.06l3.71-3.83a.75.75 0 1 1 1.08 1.04l-4.25 4.39a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06z' clip-rule='evenodd'/%3E%3C/svg%3E\")",
                          backgroundRepeat: "no-repeat",
                          backgroundPosition: "right 0.75rem center",
                          backgroundSize: "1.25rem 1.25rem",
                          paddingRight: "2.5rem",
                        }}
                      >
                        <option value="">
                          {isAblCollateralFlow ||
                          (getSbaCollateralTypeLabel(selectedProduct) ||
                            "Business / Industry Type") ===
                            "Business / Industry Type"
                            ? "Select business type"
                            : "Select property type"}
                        </option>
                        {(isAblCollateralFlow
                          ? getAblCollateralTypeOptions(selectedProduct)
                          : getSbaCollateralTypeOptions(selectedProduct) ||
                            SBA_BUSINESS_INDUSTRY_TYPES)!.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>

                      {errors["loanRequest.collateralType"] && (
                        <p className="mt-1 text-xs text-red-500">
                          {errors["loanRequest.collateralType"]}
                        </p>
                      )}

                      {/* ================= ADD COLLATERAL (chip input) ================= */}
                      <AddCollateralChips
                        items={formData.loanRequest.additionalCollateral}
                        onChange={(items) =>
                          updateLoanRequest("additionalCollateral", items)
                        }
                      />
                    </div>
                  ) : (
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        {isBase44BusinessCollateralProduct(selectedProduct)
                          ? "Business / Industry Type"
                          : "Property Type"}{" "}
                        <span className="text-red-500">*</span>
                      </label>

                      <select
                        value={formData.loanRequest.propertyType}
                        onChange={(e) => {
                          updateLoanRequest("propertyType", e.target.value);
                          if (isCreResidentialLikeFlow) {
                            updateLoanRequest("subPropertyType", "");
                          }
                        }}
                        className={`mt-1 w-full rounded-md border px-4 py-1 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${
                          errors["loanRequest.propertyType"]
                            ? "border-red-500 bg-red-50"
                            : "border-slate-300"
                        }`}
                      >
                        <option value="">
                          {isBase44BusinessCollateralProduct(selectedProduct)
                            ? "Select business type"
                            : "Select property type"}
                        </option>
                        {(isBase44BusinessCollateralProduct(selectedProduct)
                          ? SBA_BUSINESS_INDUSTRY_TYPES
                          : isResidential14Category(selectedCategory)
                            ? RESIDENTIAL_1_4_PROPERTY_TYPES
                            : Object.keys(PROPERTY_TYPE_MAP)
                        ).map((type) => (
                          <option key={type} value={type}>
                            {isResidential14Category(selectedCategory) ||
                            isBase44BusinessCollateralProduct(selectedProduct)
                              ? type
                              : type.replace(/_/g, " ")}
                          </option>
                        ))}
                      </select>

                      {errors["loanRequest.propertyType"] && (
                        <p className="mt-1 text-xs text-red-500">
                          {errors["loanRequest.propertyType"]}
                        </p>
                      )}
                    </div>
                  )}

                  {isCreResidentialLikeFlow && (
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        Sub Property Type{" "}
                        <span className="text-red-500">*</span>
                      </label>

                      <select
                        value={formData.loanRequest.subPropertyType}
                        onChange={(e) =>
                          updateLoanRequest("subPropertyType", e.target.value)
                        }
                        disabled={!formData.loanRequest.propertyType}
                        className={`mt-1 w-full rounded-md border px-4 py-1 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${
                          errors["loanRequest.subPropertyType"]
                            ? "border-red-500 bg-red-50"
                            : "border-slate-300"
                        }`}
                      >
                        <option value="">
                          {formData.loanRequest.propertyType
                            ? "Select sub property type"
                            : "Select property type first"}
                        </option>
                        {subPropertyOptions.map((sub) => (
                          <option key={sub} value={sub}>
                            {sub}
                          </option>
                        ))}
                      </select>

                      {errors["loanRequest.subPropertyType"] && (
                        <p className="mt-1 text-xs text-red-500">
                          {errors["loanRequest.subPropertyType"]}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      {isBase44BusinessCollateralProduct(selectedProduct)
                        ? "Business Address"
                        : "Property Address"}{" "}
                      <span className="text-red-500">*</span>
                    </label>

                    <input
                      value={formData.loanRequest.businessAddress}
                      onChange={(e) =>
                        updateLoanRequest("businessAddress", e.target.value)
                      }
                      placeholder="123 Main Street"
                      className={`mt-1 w-full rounded-md border px-4 py-1 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${
                        errors["loanRequest.businessAddress"]
                          ? "border-red-500 bg-red-50"
                          : "border-slate-300"
                      }`}
                    />

                    {errors["loanRequest.businessAddress"] && (
                      <p className="mt-1 text-xs text-red-500">
                        {errors["loanRequest.businessAddress"]}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      City <span className="text-red-500">*</span>
                    </label>

                    <input
                      value={formData.loanRequest.city}
                      onChange={(e) =>
                        updateLoanRequest("city", e.target.value)
                      }
                      className={`mt-1 w-full rounded-md border px-4 py-1 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${
                        errors["loanRequest.city"]
                          ? "border-red-500 bg-red-50"
                          : "border-slate-300"
                      }`}
                    />

                    {errors["loanRequest.city"] && (
                      <p className="mt-1 text-xs text-red-500">
                        {errors["loanRequest.city"]}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      State <span className="text-red-500">*</span>
                    </label>

                    <select
                      value={formData.loanRequest.state}
                      onChange={(e) =>
                        updateLoanRequest("state", e.target.value)
                      }
                      className={`mt-1 w-full rounded-md border px-4 py-1 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${
                        errors["loanRequest.state"]
                          ? "border-red-500 bg-red-50"
                          : "border-slate-300"
                      }`}
                    >
                      <option value="">Select state</option>
                      {US_STATES.map((state) => (
                        <option key={state} value={state}>
                          {state}
                        </option>
                      ))}
                    </select>

                    {errors["loanRequest.state"] && (
                      <p className="mt-1 text-xs text-red-500">
                        {errors["loanRequest.state"]}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      ZIP <span className="text-red-500">*</span>
                    </label>

                    <input
                      type="text"
                      inputMode="numeric"
                      value={formData.loanRequest.zip}
                      onChange={(e) => {
                        const value = e.target.value
                          .replace(/[^\d-]/g, "")
                          .slice(0, 10);
                        updateLoanRequest("zip", value);
                      }}
                      className={`mt-1 w-full rounded-md border px-4 py-1 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${
                        errors["loanRequest.zip"]
                          ? "border-red-500 bg-red-50"
                          : "border-slate-300"
                      }`}
                    />

                    {errors["loanRequest.zip"] && (
                      <p className="mt-1 text-xs text-red-500">
                        {errors["loanRequest.zip"]}
                      </p>
                    )}
                  </div>

                  {(isResidential14Category(selectedCategory) ||
                    isCreResidentialLikeFlow ||
                    isCreBase44Flow ||
                    isSbaRealEstateCollateralProduct(selectedProduct)) && (
                    <div>
                      <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        Number of Units
                      </label>

                      <input
                        type="text"
                        inputMode="numeric"
                        value={formData.loanRequest.numberOfUnits}
                        onChange={(e) =>
                          updateLoanRequest(
                            "numberOfUnits",
                            e.target.value.replace(/\D/g, ""),
                          )
                        }
                        placeholder="e.g. 4"
                        className="mt-1 w-full rounded-md border border-slate-300 px-4 py-1 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                      />
                    </div>
                  )}

                  {/* ================= SALE DETAILS ================= */}

                  {/* {(isSbaUsdaCollateralFlow || isAblCollateralFlow) && (
                    <div className="md:col-span-2">
                      <SaleDetailsCard
                        privateSale={formData.loanRequest.privateSale}
                        vendorName={formData.loanRequest.vendorName}
                        vendorPhone={formData.loanRequest.vendorPhone}
                        onPrivateSaleChange={(v) =>
                          updateLoanRequest("privateSale", v)
                        }
                        onVendorNameChange={(v) =>
                          updateLoanRequest("vendorName", v)
                        }
                        onVendorPhoneChange={(v) =>
                          updateLoanRequest("vendorPhone", v)
                        }
                        formatUSPhone={formatUSPhone}
                      />
                    </div>
                  )} */}
                </div>
              ) : (
                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1 dark:text-slate-300">
                      Property Type <span className="text-red-500">*</span>
                    </label>

                    <select
                      value={formData.loanRequest.propertyType}
                      onChange={(e) => {
                        updateLoanRequest("propertyType", e.target.value);
                        updateLoanRequest("subPropertyType", ""); // reset child
                      }}
                      className={`w-full px-4 py-1 rounded-md border
border-slate-300 dark:border-slate-600
bg-white dark:bg-slate-900
text-slate-800 dark:text-slate-200
focus:ring-2 focus:ring-blue-500/20
focus:border-blue-500 outline-none text-sm ${
                        errors["loanRequest.propertyType"]
                          ? "border-red-500 bg-red-50"
                          : "border-slate-300"
                      } bg-white focus:ring-2 focus:ring-blue-500/20
  focus:border-blue-500 outline-none text-sm`}
                    >
                      <option value="">Select Property Type</option>
                      {Object.keys(PROPERTY_TYPE_MAP).map((type) => (
                        <option key={type} value={type}>
                          {type.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                    {errors["loanRequest.propertyType"] && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors["loanRequest.propertyType"]}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1 dark:text-slate-300">
                      Sub Property Type <span className="text-red-500">*</span>
                    </label>

                    <select
                      value={formData.loanRequest.subPropertyType}
                      onChange={(e) =>
                        updateLoanRequest("subPropertyType", e.target.value)
                      }
                      disabled={!formData.loanRequest.propertyType}
                      className={`w-full px-4 py-1 rounded-md border
border-slate-300 dark:border-slate-600
bg-white dark:bg-slate-900
text-slate-800 dark:text-slate-200
focus:ring-2 focus:ring-blue-500/20
focus:border-blue-500 outline-none text-sm ${
                        errors["loanRequest.subPropertyType"]
                          ? "border-red-500 bg-red-50"
                          : "border-slate-300"
                      } bg-white focus:ring-2 focus:ring-blue-500/20
  focus:border-blue-500 outline-none text-sm`}
                    >
                      <option value="">
                        {formData.loanRequest.propertyType
                          ? "Select Sub Property Type"
                          : "Select Property Type First"}
                      </option>

                      {subPropertyOptions.map((sub) => (
                        <option key={sub} value={sub}>
                          {sub}
                        </option>
                      ))}
                    </select>
                    {errors["loanRequest.subPropertyType"] && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors["loanRequest.subPropertyType"]}
                      </p>
                    )}
                  </div>

                  {/* Market Value */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1 dark:text-slate-300">
                      Current Market Value (As-Is){" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formData.loanRequest.currentMarketValue}
                      onChange={(e) =>
                        handleAmountChange(
                          "loanRequest",
                          "currentMarketValue",
                          e.target.value,
                        )
                      }
                      placeholder="1,500,000"
                      className={`w-full px-4 py-1 rounded-md border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${
                        errors["loanRequest.currentMarketValue"]
                          ? "border-red-500 bg-red-50"
                          : "border-slate-300"
                      } 
          focus:ring-2 focus:ring-blue-500/20 
          focus:border-blue-500 outline-none transition text-sm`}
                    />
                    {errors["loanRequest.currentMarketValue"] && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors["loanRequest.currentMarketValue"]}
                      </p>
                    )}
                  </div>

                  {/* Purchase Price */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1 dark:text-slate-300">
                      Purchase Price $ <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formData.loanRequest.purchasePrice}
                      onChange={(e) =>
                        handleAmountChange(
                          "loanRequest",
                          "purchasePrice",
                          e.target.value,
                        )
                      }
                      placeholder="1,200,000"
                      className={`w-full px-4 py-1 rounded-md border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${
                        errors["loanRequest.purchasePrice"]
                          ? "border-red-500 bg-red-50"
                          : "border-slate-300"
                      } 
          focus:ring-2 focus:ring-blue-500/20 
          focus:border-blue-500 outline-none transition text-sm`}
                    />
                    {errors["loanRequest.purchasePrice"] && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors["loanRequest.purchasePrice"]}
                      </p>
                    )}
                  </div>

                  {/* After Repair Value */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1 dark:text-slate-300">
                      After Repair Value (ARV) $
                      <span className="text-red-500">*</span>
                    </label>

                    <input
                      type="text"
                      inputMode="numeric"
                      value={formData.loanRequest.afterRepairValue}
                      onChange={(e) =>
                        handleAmountChange(
                          "loanRequest",
                          "afterRepairValue",
                          e.target.value,
                        )
                      }
                      placeholder="2,000,000"
                      className={`w-full px-4 py-1 rounded-md border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${
                        errors["loanRequest.afterRepairValue"]
                          ? "border-red-500 bg-red-50"
                          : "border-slate-300"
                      }
    focus:ring-2 focus:ring-blue-500/20
    focus:border-blue-500 outline-none transition text-sm`}
                    />

                    {errors["loanRequest.afterRepairValue"] && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors["loanRequest.afterRepairValue"]}
                      </p>
                    )}
                  </div>

                  {/* Purchase Date */}
                  {showPropertyPurchaseDate && (
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1 dark:text-slate-300">
                        Purchase Date <span className="text-red-500">*</span>
                      </label>
                      <LoanDateField
                        value={formData.loanRequest.purchaseDate}
                        onChange={(val) =>
                          updateLoanRequest("purchaseDate", val)
                        }
                        className={
                          errors["loanRequest.purchaseDate"]
                            ? "border-red-500 bg-red-50"
                            : ""
                        }
                      />
                      {errors["loanRequest.purchaseDate"] && (
                        <p className="text-xs text-red-500 mt-1">
                          {errors["loanRequest.purchaseDate"]}
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1 dark:text-slate-300">
                      Total Assets ($) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      value={formData.loanRequest.totalAssets}
                      onChange={(e) =>
                        handleAmountChange(
                          "loanRequest",
                          "totalAssets",
                          e.target.value,
                        )
                      }
                      className={`w-full px-4 py-1 rounded-md border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200  ${
                        errors["loanRequest.totalAssets"]
                          ? "border-red-500 bg-red-50"
                          : "border-slate-300"
                      }
    focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm`}
                    />
                    {errors["loanRequest.totalAssets"] && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors["loanRequest.totalAssets"]}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1 dark:text-slate-300">
                      Total Liabilities ($){" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      value={formData.loanRequest.totalLiabilities}
                      onChange={(e) =>
                        handleAmountChange(
                          "loanRequest",
                          "totalLiabilities",
                          e.target.value,
                        )
                      }
                      className={`w-full px-4 py-1 rounded-md border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200  ${
                        errors["loanRequest.totalLiabilities"]
                          ? "border-red-500 bg-red-50"
                          : "border-slate-300"
                      }
    focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm`}
                    />
                    {errors["loanRequest.totalLiabilities"] && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors["loanRequest.totalLiabilities"]}
                      </p>
                    )}
                  </div>

                  {/* ================= BUSINESS ADDRESS ================= */}

                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      Business Address <span className="text-red-500">*</span>
                    </label>

                    <input
                      value={formData.loanRequest.businessAddress}
                      onChange={(e) =>
                        updateLoanRequest("businessAddress", e.target.value)
                      }
                      placeholder="123 Main Street"
                      className={`mt-1 w-full px-4 py-1 rounded-md border 
    dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200
    ${
      errors["loanRequest.businessAddress"]
        ? "border-red-500 bg-red-50"
        : "border-slate-300"
    }
    focus:ring-2 focus:ring-blue-500/20 
    focus:border-blue-500 outline-none text-sm`}
                    />

                    {errors["loanRequest.businessAddress"] && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors["loanRequest.businessAddress"]}
                      </p>
                    )}
                  </div>

                  {/* CITY */}
                  <div>
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      City <span className="text-red-500">*</span>
                    </label>

                    <input
                      value={formData.loanRequest.city}
                      onChange={(e) =>
                        updateLoanRequest("city", e.target.value)
                      }
                      className={`mt-1 w-full px-4 py-1 rounded-md border 
    dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200
    ${
      errors["loanRequest.city"]
        ? "border-red-500 bg-red-50"
        : "border-slate-300"
    }
    focus:ring-2 focus:ring-blue-500/20 
    focus:border-blue-500 outline-none text-sm`}
                    />

                    {errors["loanRequest.city"] && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors["loanRequest.city"]}
                      </p>
                    )}
                  </div>

                  {/* STATE */}
                  <div>
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      State <span className="text-red-500">*</span>
                    </label>

                    <select
                      value={formData.loanRequest.state}
                      onChange={(e) =>
                        updateLoanRequest("state", e.target.value)
                      }
                      className={`w-full px-4 py-1 rounded-md border 
    dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200
    ${
      errors["loanRequest.state"]
        ? "border-red-500 bg-red-50"
        : "border-slate-300"
    }
    focus:ring-2 focus:ring-blue-500/20 
    focus:border-blue-500 outline-none text-sm`}
                    >
                      <option value="">Select state</option>
                      {US_STATES.map((state) => (
                        <option key={state} value={state}>
                          {state}
                        </option>
                      ))}
                    </select>

                    {errors["loanRequest.state"] && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors["loanRequest.state"]}
                      </p>
                    )}
                  </div>

                  {/* ZIP */}
                  <div>
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      ZIP <span className="text-red-500">*</span>
                    </label>

                    <input
                      type="text"
                      inputMode="numeric"
                      value={formData.loanRequest.zip}
                      onChange={(e) => {
                        const value = e.target.value
                          .replace(/[^\d-]/g, "")
                          .slice(0, 10);

                        updateLoanRequest("zip", value);
                      }}
                      placeholder="12345 or 12345-6789"
                      className={`mt-1 w-full px-4 py-1 rounded-md border 
    dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200
    ${
      errors["loanRequest.zip"]
        ? "border-red-500 bg-red-50"
        : "border-slate-300"
    }
    focus:ring-2 focus:ring-blue-500/20 
    focus:border-blue-500 outline-none text-sm`}
                    />

                    {errors["loanRequest.zip"] && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors["loanRequest.zip"]}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {showPrivateDetails(
                selectedProduct,
                formData.loanRequest.purpose,
              ) ? (
                <div className="md:col-span-2">
                  <SaleDetailsCard
                    privateSale={formData.loanRequest.privateSale}
                    vendorName={formData.loanRequest.vendorName}
                    vendorPhone={formData.loanRequest.vendorPhone}
                    onPrivateSaleChange={(v) =>
                      updateLoanRequest("privateSale", v)
                    }
                    onVendorNameChange={(v) =>
                      updateLoanRequest("vendorName", v)
                    }
                    onVendorPhoneChange={(v) =>
                      updateLoanRequest("vendorPhone", v)
                    }
                    formatUSPhone={formatUSPhone}
                  />
                </div>
              ) : null}
            </div>
          )}

          {/* step-3 — Co-Broker (embedded public-embed only) */}
          {includeCoBrokerBorrowerInformationTab &&
            baseSteps[currentStep] === CO_BROKER_BORROWER_INFO_STEP && (
              <div className="mt-6 relative z-10 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
                <h3 className="mb-1 inline-block border-b-2 border-[#2C92D5] pb-2 text-lg font-semibold dark:text-white">
                  Step 4: {CO_BROKER_BORROWER_INFO_STEP}
                </h3>
                <p className="mb-4 text-xs text-slate-500">
                  Let us know if you're filling this out on behalf of a broker
                  or loan officer.
                </p>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                    Are you a broker, or are you working with a mortgage broker
                    / loan officer? <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-6">
                    {[
                      { value: "yes", label: "Yes" },
                      { value: "no", label: "No" },
                    ].map((opt) => (
                      <label
                        key={opt.value}
                        className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"
                      >
                        <input
                          type="radio"
                          name="workingWithMortgageBroker"
                          value={opt.value}
                          checked={
                            formData.workingWithMortgageBroker === opt.value
                          }
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              workingWithMortgageBroker: e.target
                                .value as WorkingWithMortgageBrokerAnswer,
                            }))
                          }
                          className="h-4 w-4 text-[#2C92D5] focus:ring-[#2C92D5]"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                  {errors["workingWithMortgageBroker"] && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors["workingWithMortgageBroker"]}
                    </p>
                  )}
                </div>

                {formData.workingWithMortgageBroker === "yes" && (
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      {/* First Name + Last Name */}
                      {(["firstName", "lastName"] as const).map((field) => (
                        <div key={field}>
                          <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                            {field === "firstName" ? "First Name" : "Last Name"}
                            <span className="text-red-500"> *</span>
                          </label>
                          <input
                            type="text"
                            value={
                              (formData.referringBroker as any)?.[field] || ""
                            }
                            onChange={(e) => {
                              const value = e.target.value;
                              setFormData((prev) => ({
                                ...prev,
                                referringBroker: {
                                  ...createEmptyReferringBroker(),
                                  ...prev.referringBroker,
                                  [field]: value,
                                },
                              }));
                              // validation
                              setErrors((prev) => {
                                const updated = { ...prev };
                                if (!value.trim()) {
                                  updated[`referringBroker.${field}`] =
                                    field === "firstName"
                                      ? "First name is required"
                                      : "Last name is required";
                                } else {
                                  delete updated[`referringBroker.${field}`];
                                }
                                return updated;
                              });
                            }}
                            className={`w-full px-4 py-1 rounded-md border bg-white dark:bg-slate-900 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none ${
                              errors[`referringBroker.${field}`]
                                ? "border-red-500 bg-red-50"
                                : "border-slate-300 dark:border-slate-600"
                            }`}
                          />
                          {errors[`referringBroker.${field}`] && (
                            <p className="text-xs text-red-500 mt-1">
                              {errors[`referringBroker.${field}`]}
                            </p>
                          )}
                        </div>
                      ))}

                      {/* Company Name */}
                      <div>
                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                          Company Name <span className="text-red-500"> *</span>
                        </label>
                        <input
                          type="text"
                          value={formData.referringBroker?.companyName || ""}
                          onChange={(e) => {
                            const value = e.target.value;
                            setFormData((prev) => ({
                              ...prev,
                              referringBroker: {
                                ...createEmptyReferringBroker(),
                                ...prev.referringBroker,
                                companyName: value,
                              },
                            }));
                            setErrors((prev) => {
                              const updated = { ...prev };
                              if (!value.trim()) {
                                updated["referringBroker.companyName"] =
                                  "Company name is required";
                              } else {
                                delete updated["referringBroker.companyName"];
                              }
                              return updated;
                            });
                          }}
                          className={`w-full px-4 py-1 rounded-md border bg-white dark:bg-slate-900 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none ${
                            errors["referringBroker.companyName"]
                              ? "border-red-500 bg-red-50"
                              : "border-slate-300 dark:border-slate-600"
                          }`}
                        />
                        {errors["referringBroker.companyName"] && (
                          <p className="text-xs text-red-500 mt-1">
                            {errors["referringBroker.companyName"]}
                          </p>
                        )}
                      </div>

                      {/* Phone — US formatted */}
                      <div>
                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                          Phone <span className="text-red-500"> *</span>
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="(555) 555-5555"
                          value={formData.referringBroker?.phone || ""}
                          onChange={(e) => {
                            const formatted = formatUSPhone(e.target.value);
                            setFormData((prev) => ({
                              ...prev,
                              referringBroker: {
                                ...createEmptyReferringBroker(),
                                ...prev.referringBroker,
                                phone: formatted,
                              },
                            }));
                            // US phone: (XXX) XXX-XXXX = 14 chars
                            setErrors((prev) => {
                              const updated = { ...prev };
                              if (!formatted.trim()) {
                                updated["referringBroker.phone"] =
                                  "Phone is required";
                              } else if (
                                formatted.replace(/\D/g, "").length !== 10
                              ) {
                                updated["referringBroker.phone"] =
                                  "Enter a valid 10-digit US phone number";
                              } else {
                                delete updated["referringBroker.phone"];
                              }
                              return updated;
                            });
                          }}
                          className={`w-full px-4 py-1 rounded-md border bg-white dark:bg-slate-900 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none ${
                            errors["referringBroker.phone"]
                              ? "border-red-500 bg-red-50"
                              : "border-slate-300 dark:border-slate-600"
                          }`}
                        />
                        {errors["referringBroker.phone"] && (
                          <p className="text-xs text-red-500 mt-1">
                            {errors["referringBroker.phone"]}
                          </p>
                        )}
                      </div>

                      {/* Email — full width */}
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                          Email <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          value={formData.referringBroker?.email || ""}
                          onChange={(e) => {
                            const value = e.target.value;
                            setFormData((prev) => ({
                              ...prev,
                              referringBroker: {
                                ...createEmptyReferringBroker(),
                                ...prev.referringBroker,
                                email: value,
                              },
                            }));
                            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                            setErrors((prev) => {
                              const updated = { ...prev };
                              if (!value.trim()) {
                                updated["referringBroker.email"] =
                                  "Email is required";
                              } else if (!emailRegex.test(value)) {
                                updated["referringBroker.email"] =
                                  "Enter a valid email address";
                              } else {
                                delete updated["referringBroker.email"];
                              }
                              return updated;
                            });
                          }}
                          className={`w-full px-4 py-1 rounded-md border bg-white dark:bg-slate-900 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none ${
                            errors["referringBroker.email"]
                              ? "border-red-500 bg-red-50"
                              : "border-slate-300 dark:border-slate-600"
                          }`}
                        />
                        {errors["referringBroker.email"] && (
                          <p className="text-xs text-red-500 mt-1">
                            {errors["referringBroker.email"]}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

          {/* step — Borrower Info */}
          {baseSteps[currentStep] === "Borrower Info" && (
            <>
              {useResidentialBorrowerPanel ? (
                <div className="mt-6 relative z-10 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
                  <h3 className="mb-1 inline-block border-b-2 border-[#2C92D5] pb-2 text-lg font-semibold dark:text-white">
                    Step 4: Borrower Info
                  </h3>

                  <ResidentialBorrowerPanel
                    borrowerIndex={0}
                    isPrimary
                    borrower={formData.borrower}
                    errors={errors}
                    errorPrefix="borrower"
                    formatUSPhone={formatUSPhone}
                    formatSSN={formatSSN}
                    onFieldChange={(field, value) =>
                      updateBorrower(field, value)
                    }
                    onAssetChange={(field, value) =>
                      updateBorrowerNested("borrower", "assets", field, value)
                    }
                    onLiabilityChange={(field, value) =>
                      updateBorrowerNested(
                        "borrower",
                        "liabilities",
                        field,
                        value,
                      )
                    }
                    onDeclarationChange={(field, value) =>
                      updateBorrowerNested(
                        "borrower",
                        "declarations",
                        field,
                        value,
                      )
                    }
                    onAddProperty={() => addBorrowerProperty("borrower")}
                    onRemoveProperty={(propertyId) =>
                      removeBorrowerProperty("borrower", propertyId)
                    }
                    onPropertyChange={(propertyId, field, value) => {
                      if (
                        [
                          "rehabUpgradeCost",
                          "currentMarketValue",
                          "loanMortgageBalance",
                          "grossRentalIncome",
                          "loanTaxInsurancePaymentYr",
                          "noiPerYear",
                          "totalEquity",
                        ].includes(field)
                      ) {
                        updateBorrowerPropertyAmount(
                          "borrower",
                          propertyId,
                          field,
                          value,
                        );
                        return;
                      }
                      updateBorrowerProperty(
                        "borrower",
                        propertyId,
                        field,
                        value,
                      );
                    }}
                    onAmountChange={(field, value) =>
                      updateBorrowerAmountField(
                        "borrower",
                        field as "totalCashReserves" | "existingDebt",
                        value,
                      )
                    }
                  />

                  {formData.coBorrowers.map((borrower, index) => (
                    <div
                      key={borrower.id}
                      ref={(el) => {
                        coBorrowerRefs.current[borrower.id] = el;
                      }}
                    >
                      <ResidentialBorrowerPanel
                        borrowerIndex={index + 1}
                        isPrimary={false}
                        borrower={borrower}
                        errors={errors}
                        errorPrefix={`coBorrowers.${index}`}
                        formatUSPhone={formatUSPhone}
                        formatSSN={formatSSN}
                        onFieldChange={(field, value) =>
                          updateCoBorrower(index, field, value)
                        }
                        onAssetChange={(field, value) =>
                          updateBorrowerNested(
                            "coBorrower",
                            "assets",
                            field,
                            value,
                            index,
                          )
                        }
                        onLiabilityChange={(field, value) =>
                          updateBorrowerNested(
                            "coBorrower",
                            "liabilities",
                            field,
                            value,
                            index,
                          )
                        }
                        onDeclarationChange={(field, value) =>
                          updateBorrowerNested(
                            "coBorrower",
                            "declarations",
                            field,
                            value,
                            index,
                          )
                        }
                        onAddProperty={() =>
                          addBorrowerProperty("coBorrower", index)
                        }
                        onRemoveProperty={(propertyId) =>
                          removeBorrowerProperty(
                            "coBorrower",
                            propertyId,
                            index,
                          )
                        }
                        onPropertyChange={(propertyId, field, value) => {
                          if (
                            [
                              "rehabUpgradeCost",
                              "currentMarketValue",
                              "loanMortgageBalance",
                              "grossRentalIncome",
                              "loanTaxInsurancePaymentYr",
                              "noiPerYear",
                              "totalEquity",
                            ].includes(field)
                          ) {
                            updateBorrowerPropertyAmount(
                              "coBorrower",
                              propertyId,
                              field,
                              value,
                              index,
                            );
                            return;
                          }
                          updateBorrowerProperty(
                            "coBorrower",
                            propertyId,
                            field,
                            value,
                            index,
                          );
                        }}
                        onRemove={() => handleRemoveCoBorrower(borrower.id)}
                        onAmountChange={(field, value) =>
                          updateBorrowerAmountField(
                            "coBorrower",
                            field as "totalCashReserves" | "existingDebt",
                            value,
                            index,
                          )
                        }
                      />
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={handleAddCoBorrower}
                    className="mt-4 flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                  >
                    + Add Borrower
                  </button>
                </div>
              ) : (
                <>
                  <div
                    className="border border-slate-200 dark:border-slate-700 
rounded-2xl p-6 bg-white dark:bg-slate-800"
                  >
                    {/* Header Row */}
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold dark:text-white">
                        Borrower Information
                      </h3>

                      <button
                        type="button"
                        onClick={handleAddCoBorrower}
                        className="px-4 py-2 rounded-md border border-slate-300 
               text-sm font-medium hover:bg-slate-100 transition dark:text-white dark:hover:bg-slate-600"
                      >
                        + Add Co-Borrower
                      </button>
                    </div>

                    {/* Primary Borrower */}
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium text-slate-700 dark:text-white">
                        Primary Borrower
                      </h4>
                    </div>

                    {/* Form Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                          Name<span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.borrower.name}
                          onChange={(e) =>
                            updateBorrower("name", e.target.value)
                          }
                          className={`mt-1 w-full px-4 py-1 rounded-md border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${
                            errors["borrower.name"]
                              ? "border-red-500 bg-red-50"
                              : "border-slate-300"
                          }
                     focus:ring-2 focus:ring-blue-500/20 
                     focus:border-blue-500 outline-none text-sm`}
                        />
                        {errors["borrower.name"] && (
                          <p className="text-xs text-red-500 mt-1">
                            {errors["borrower.name"]}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                          Entity Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.borrower.entityName}
                          onChange={(e) =>
                            updateBorrower("entityName", e.target.value)
                          }
                          className={`mt-1 w-full px-4 py-1 rounded-md border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200  ${
                            errors["borrower.entityName"]
                              ? "border-red-500 bg-red-50"
                              : "border-slate-300"
                          }
                     focus:ring-2 focus:ring-blue-500/20 
                     focus:border-blue-500 outline-none text-sm`}
                        />
                        {errors["borrower.entityName"] && (
                          <p className="text-xs text-red-500 mt-1">
                            {errors["borrower.entityName"]}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                          Phone <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="tel"
                          inputMode="numeric"
                          required
                          value={formData.borrower.phone}
                          onChange={(e) => {
                            const formatted = formatUSPhone(e.target.value);
                            updateBorrower("phone", formatted);

                            const error = validateFieldValue(
                              "phone",
                              formatted,
                              true,
                            );

                            setErrors((prev) => {
                              const updated = { ...prev };
                              if (error) {
                                updated["borrower.phone"] = error;
                              } else {
                                delete updated["borrower.phone"];
                              }
                              return updated;
                            });
                          }}
                          className={`mt-1 w-full px-4 py-1 rounded-md border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200  ${
                            errors["borrower.phone"]
                              ? "border-red-500 bg-red-50"
                              : "border-slate-300"
                          }
                     focus:ring-2 focus:ring-blue-500/20 
                     focus:border-blue-500 outline-none text-sm`}
                        />
                        {errors["borrower.phone"] && (
                          <p className="text-xs text-red-500 mt-1">
                            {errors["borrower.phone"]}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                          Email <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          required
                          value={formData.borrower.email}
                          onChange={(e) =>
                            updateBorrower("email", e.target.value)
                          }
                          className={`mt-1 w-full px-4 py-1 rounded-md border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200  ${
                            errors["borrower.email"]
                              ? "border-red-500 bg-red-50"
                              : "border-slate-300"
                          }
                     focus:ring-2 focus:ring-blue-500/20 
                     focus:border-blue-500 outline-none text-sm`}
                        />
                        {errors["borrower.email"] && (
                          <p className="text-xs text-red-500 mt-1">
                            {errors["borrower.email"]}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                          Employer / Self-Employed{" "}
                          <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.borrower.employer}
                          onChange={(e) =>
                            updateBorrower("employer", e.target.value)
                          }
                          className={`mt-1 w-full px-4 py-1 rounded-md border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${
                            errors["borrower.employer"]
                              ? "border-red-500 bg-red-50"
                              : "border-slate-300"
                          }
                     focus:ring-2 focus:ring-blue-500/20 
                     focus:border-blue-500 outline-none text-sm`}
                        />
                        {errors["borrower.employer"] && (
                          <p className="text-xs text-red-500 mt-1">
                            {errors["borrower.employer"]}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                          DOB (mm/dd/yyyy){" "}
                          <span className="text-red-500">*</span>
                        </label>
                        <LoanDateField
                          value={formData.borrower.dob}
                          onChange={(val) => updateBorrower("dob", val)}
                          className={`mt-1 ${
                            errors["borrower.dob"]
                              ? "border-red-500 bg-red-50"
                              : ""
                          }`}
                        />
                        {errors["borrower.dob"] && (
                          <p className="text-xs text-red-500 mt-1">
                            {errors["borrower.dob"]}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                          SSN <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.borrower.ssn}
                          onChange={(e) => {
                            const formatted = formatSSN(e.target.value);
                            updateBorrower("ssn", formatted);

                            const error = validateFieldValue(
                              "ssn",
                              formatted,
                              true,
                            );

                            setErrors((prev) => {
                              const updated = { ...prev };
                              if (error) {
                                updated["borrower.ssn"] = error;
                              } else {
                                delete updated["borrower.ssn"];
                              }
                              return updated;
                            });
                          }}
                          className={`mt-1 w-full px-4 py-1 rounded-md border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${
                            errors["borrower.ssn"]
                              ? "border-red-500 bg-red-50"
                              : "border-slate-300"
                          }
                     focus:ring-2 focus:ring-blue-500/20 
                     focus:border-blue-500 outline-none text-sm`}
                        />
                        {errors["borrower.ssn"] && (
                          <p className="text-xs text-red-500 mt-1">
                            {errors["borrower.ssn"]}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                          Credit Score <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formData.borrower.creditScore}
                          onChange={(e) =>
                            updateBorrower("creditScore", e.target.value)
                          }
                          className={`mt-1 w-full px-4 py-1 rounded-md border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${
                            errors["borrower.creditScore"]
                              ? "border-red-500 bg-red-50"
                              : "border-slate-300"
                          }
                     focus:ring-2 focus:ring-blue-500/20 
                     focus:border-blue-500 outline-none text-sm`}
                        />
                        {errors["borrower.creditScore"] && (
                          <p className="text-xs text-red-500 mt-1">
                            {errors["borrower.creditScore"]}
                          </p>
                        )}
                      </div>

                      <div className="md:col-span-2">
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                          Present Address{" "}
                          <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.borrower.address}
                          onChange={(e) =>
                            updateBorrower("address", e.target.value)
                          }
                          className={`mt-1 w-full px-4 py-1 rounded-md border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${
                            errors["borrower.address"]
                              ? "border-red-500 bg-red-50"
                              : "border-slate-300"
                          }
                     focus:ring-2 focus:ring-blue-500/20 
                     focus:border-blue-500 outline-none text-sm`}
                        />
                        {errors["borrower.address"] && (
                          <p className="text-xs text-red-500 mt-1">
                            {errors["borrower.address"]}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                          City <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.borrower.city}
                          onChange={(e) =>
                            updateBorrower("city", e.target.value)
                          }
                          className={`mt-1 w-full px-4 py-1 rounded-md border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${
                            errors["borrower.city"]
                              ? "border-red-500 bg-red-50"
                              : "border-slate-300"
                          }
    focus:ring-2 focus:ring-blue-500/20 
    focus:border-blue-500 outline-none text-sm`}
                        />
                        {errors["borrower.city"] && (
                          <p className="text-xs text-red-500 mt-1">
                            {errors["borrower.city"]}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                          State <span className="text-red-500">*</span>
                        </label>

                        <select
                          value={formData.borrower.state}
                          onChange={(e) =>
                            updateBorrower("state", e.target.value)
                          }
                          className={`w-full px-4 py-1 rounded-md border
border-slate-300 dark:border-slate-600
bg-white dark:bg-slate-900
text-slate-800 dark:text-slate-200
focus:ring-2 focus:ring-blue-500/20
focus:border-blue-500 outline-none text-sm ${
                            errors["borrower.state"]
                              ? "border-red-500 bg-red-50"
                              : "border-slate-300"
                          }
    bg-white focus:ring-2 focus:ring-blue-500/20 
    focus:border-blue-500 outline-none text-sm`}
                        >
                          <option value="">Select State</option>
                          {US_STATES.map((state) => (
                            <option key={state} value={state}>
                              {state}
                            </option>
                          ))}
                        </select>

                        {errors["borrower.state"] && (
                          <p className="text-xs text-red-500 mt-1">
                            {errors["borrower.state"]}
                          </p>
                        )}
                      </div>

                      <div className="md:col-span-2">
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                          Mailing Address (if different)
                        </label>
                        <input
                          type="text"
                          value={formData.borrower.mailingAddress}
                          onChange={(e) =>
                            updateBorrower("mailingAddress", e.target.value)
                          }
                          className={`mt-1 w-full px-4 py-1 rounded-md border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${
                            errors["borrower.mailingAddress"]
                              ? "border-red-500 bg-red-50"
                              : "border-slate-300"
                          }
                     focus:ring-2 focus:ring-blue-500/20 
                     focus:border-blue-500 outline-none text-sm`}
                        />
                        {errors["borrower.mailingAddress"] && (
                          <p className="text-xs text-red-500 mt-1">
                            {errors["borrower.mailingAddress"]}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  {formData.coBorrowers.map((borrower, index) => {
                    /* ================= STEP 4 CALCULATIONS ================= */
                    const toNum = (v: string) =>
                      parseFloat((v || "0").replace(/,/g, ""));

                    const coAssets = toNum(borrower.totalAssets);
                    const coLiabilities = toNum(borrower.totalLiabilities);

                    const coNetWorth = coAssets - coLiabilities;

                    return (
                      <>
                        <div
                          key={borrower.id}
                          ref={(el) => {
                            coBorrowerRefs.current[borrower.id] = el;
                          }}
                          className="border border-slate-200 dark:border-slate-700 rounded-2xl p-6 bg-white dark:bg-slate-800 mt-6 mb-6"
                        >
                          {/* Header */}
                          <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-semibold dark:text-slate-300">
                              Co-Borrower {index + 1}
                            </h3>

                            <div className="flex items-center gap-3">
                              <div className="flex gap-2 flex-wrap text-xs">
                                <span className="px-2 py-1 bg-blue-100 text-blue-600 rounded-full">
                                  Net Worth: ${coNetWorth.toLocaleString()}
                                </span>
                              </div>

                              <button
                                onClick={() =>
                                  handleRemoveCoBorrower(borrower.id)
                                }
                                className="text-red-500 hover:text-red-600 text-lg"
                              >
                                <MdDeleteForever />
                              </button>
                            </div>
                          </div>

                          {/* Fields */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium dark:text-slate-300">
                                Name <span className="text-red-500">*</span>
                              </label>
                              <input
                                required
                                value={formData.coBorrowers[index]?.name}
                                onChange={(e) =>
                                  updateCoBorrower(
                                    index,
                                    "name",
                                    e.target.value,
                                  )
                                }
                                className={`mt-1 w-full px-4 py-1 rounded-md border focus:ring-2 focus:ring-blue-500/20 
          focus:border-blue-500 outline-none transition text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${
            errors[`coBorrowers.${index}.name`]
              ? "border-red-500 bg-red-50"
              : "border-slate-300"
          }`}
                              />
                              {errors[`coBorrowers.${index}.name`] && (
                                <p className="text-xs text-red-500 mt-1">
                                  {errors[`coBorrowers.${index}.name`]}
                                </p>
                              )}
                            </div>

                            <div>
                              <label className="text-sm font-medium dark:text-slate-300">
                                Entity Name{" "}
                                <span className="text-red-500">*</span>
                              </label>
                              <input
                                value={formData.coBorrowers[index]?.entityName}
                                onChange={(e) =>
                                  updateCoBorrower(
                                    index,
                                    "entityName",
                                    e.target.value,
                                  )
                                }
                                className={`mt-1 w-full px-4 py-1 rounded-md border    focus:ring-2 focus:ring-blue-500/20 
          focus:border-blue-500 outline-none transition text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200  ${
            errors[`coBorrowers.${index}.entityName`]
              ? "border-red-500 bg-red-50"
              : "border-slate-300"
          }`}
                              />

                              {errors[`coBorrowers.${index}.entityName`] && (
                                <p className="text-xs text-red-500 mt-1">
                                  {errors[`coBorrowers.${index}.entityName`]}
                                </p>
                              )}
                            </div>

                            <div>
                              <label className="text-sm font-medium dark:text-slate-300">
                                Phone <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="tel"
                                inputMode="numeric"
                                required
                                value={formData.coBorrowers[index]?.phone}
                                onChange={(e) => {
                                  const formatted = formatUSPhone(
                                    e.target.value,
                                  );
                                  updateCoBorrower(index, "phone", formatted);
                                }}
                                className={`mt-1 w-full px-4 py-1 rounded-md border    focus:ring-2 focus:ring-blue-500/20 
          focus:border-blue-500 outline-none transition text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200  ${
            errors[`coBorrowers.${index}.phone`]
              ? "border-red-500 bg-red-50"
              : "border-slate-300"
          }`}
                              />

                              {errors[`coBorrowers.${index}.phone`] && (
                                <p className="text-xs text-red-500 mt-1">
                                  {errors[`coBorrowers.${index}.phone`]}
                                </p>
                              )}
                            </div>

                            <div>
                              <label className="text-sm font-medium dark:text-slate-300">
                                Email <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="email"
                                required
                                value={formData.coBorrowers[index]?.email}
                                onChange={(e) =>
                                  updateCoBorrower(
                                    index,
                                    "email",
                                    e.target.value,
                                  )
                                }
                                className={`mt-1 w-full px-4 py-1 rounded-md border    focus:ring-2 focus:ring-blue-500/20 
          focus:border-blue-500 outline-none transition text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200  ${
            errors[`coBorrowers.${index}.email`]
              ? "border-red-500 bg-red-50"
              : "border-slate-300"
          }`}
                              />

                              {errors[`coBorrowers.${index}.email`] && (
                                <p className="text-xs text-red-500 mt-1">
                                  {errors[`coBorrowers.${index}.email`]}
                                </p>
                              )}
                            </div>

                            <div>
                              <label className="text-sm font-medium dark:text-slate-300">
                                Employer / Self-Employed{" "}
                                <span className="text-red-500">*</span>
                              </label>
                              <input
                                value={formData.coBorrowers[index]?.employer}
                                onChange={(e) =>
                                  updateCoBorrower(
                                    index,
                                    "employer",
                                    e.target.value,
                                  )
                                }
                                className={`mt-1 w-full px-4 py-1 rounded-md border    focus:ring-2 focus:ring-blue-500/20 
          focus:border-blue-500 outline-none transition text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200  ${
            errors[`coBorrowers.${index}.employer`]
              ? "border-red-500 bg-red-50"
              : "border-slate-300"
          }`}
                              />

                              {errors[`coBorrowers.${index}.employer`] && (
                                <p className="text-xs text-red-500 mt-1">
                                  {errors[`coBorrowers.${index}.employer`]}
                                </p>
                              )}
                            </div>

                            <div>
                              <label className="text-sm font-medium dark:text-slate-300">
                                DOB (mm/dd/yyyy){" "}
                                <span className="text-red-500">*</span>
                              </label>
                              <LoanDateField
                                value={formData.coBorrowers[index]?.dob}
                                onChange={(val) =>
                                  updateCoBorrower(index, "dob", val)
                                }
                                className={`mt-1 ${
                                  errors[`coBorrowers.${index}.dob`]
                                    ? "border-red-500 bg-red-50"
                                    : ""
                                }`}
                              />

                              {errors[`coBorrowers.${index}.dob`] && (
                                <p className="text-xs text-red-500 mt-1">
                                  {errors[`coBorrowers.${index}.dob`]}
                                </p>
                              )}
                            </div>

                            <div>
                              <label className="text-sm font-medium dark:text-slate-300">
                                SSN <span className="text-red-500">*</span>
                              </label>
                              <input
                                required
                                value={formData.coBorrowers[index]?.ssn}
                                onChange={(e) => {
                                  const formatted = formatSSN(e.target.value);
                                  updateCoBorrower(index, "ssn", formatted);
                                }}
                                className={`mt-1 w-full px-4 py-1 rounded-md border    focus:ring-2 focus:ring-blue-500/20 
          focus:border-blue-500 outline-none transition text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200  ${
            errors[`coBorrowers.${index}.ssn`]
              ? "border-red-500 bg-red-50"
              : "border-slate-300"
          }`}
                              />

                              {errors[`coBorrowers.${index}.ssn`] && (
                                <p className="text-xs text-red-500 mt-1">
                                  {errors[`coBorrowers.${index}.ssn`]}
                                </p>
                              )}
                            </div>

                            <div>
                              <label className="text-sm font-medium dark:text-slate-300">
                                Credit Score{" "}
                                <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="number"
                                value={formData.coBorrowers[index]?.creditScore}
                                onChange={(e) =>
                                  updateCoBorrower(
                                    index,
                                    "creditScore",
                                    e.target.value,
                                  )
                                }
                                className={`text-sm mt-1 w-full px-4 py-1 rounded-md border focus:ring-2 focus:ring-blue-500/20 
          focus:border-blue-500 outline-none transition dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200  ${
            errors[`coBorrowers.${index}.creditScore`]
              ? "border-red-500 bg-red-50"
              : "border-slate-300"
          }`}
                              />

                              {errors[`coBorrowers.${index}.creditScore`] && (
                                <p className="text-xs text-red-500 mt-1">
                                  {errors[`coBorrowers.${index}.creditScore`]}
                                </p>
                              )}
                            </div>

                            <div className="md:col-span-2">
                              <label className="text-sm font-medium dark:text-slate-300">
                                Present Address{" "}
                                <span className="text-red-500">*</span>
                              </label>
                              <input
                                value={formData.coBorrowers[index]?.address}
                                onChange={(e) =>
                                  updateCoBorrower(
                                    index,
                                    "address",
                                    e.target.value,
                                  )
                                }
                                required
                                className={`text-sm mt-1 w-full px-4 py-1 rounded-md border focus:ring-2 focus:ring-blue-500/20 
          focus:border-blue-500 outline-none transition dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200  ${
            errors[`coBorrowers.${index}.address`]
              ? "border-red-500 bg-red-50"
              : "border-slate-300"
          }`}
                              />

                              {errors[`coBorrowers.${index}.address`] && (
                                <p className="text-xs text-red-500 mt-1">
                                  {errors[`coBorrowers.${index}.address`]}
                                </p>
                              )}
                            </div>

                            <div>
                              <label className="text-sm font-medium dark:text-slate-300">
                                City <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                value={formData.coBorrowers[index]?.city}
                                onChange={(e) =>
                                  updateCoBorrower(
                                    index,
                                    "city",
                                    e.target.value,
                                  )
                                }
                                className={`mt-1 w-full px-4 py-1 rounded-md border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${
                                  errors[`coBorrowers.${index}.city`]
                                    ? "border-red-500 bg-red-50"
                                    : "border-slate-300"
                                } focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm`}
                              />
                              {errors[`coBorrowers.${index}.city`] && (
                                <p className="text-xs text-red-500 mt-1">
                                  {errors[`coBorrowers.${index}.city`]}
                                </p>
                              )}
                            </div>

                            <div>
                              <label className="text-sm font-medium dark:text-slate-300">
                                State <span className="text-red-500">*</span>
                              </label>

                              <select
                                value={formData.coBorrowers[index]?.state}
                                onChange={(e) =>
                                  updateCoBorrower(
                                    index,
                                    "state",
                                    e.target.value,
                                  )
                                }
                                className={`w-full px-4 py-1 rounded-md border
border-slate-300 dark:border-slate-600
bg-white dark:bg-slate-900
text-slate-800 dark:text-slate-200
focus:ring-2 focus:ring-blue-500/20
focus:border-blue-500 outline-none text-sm ${
                                  errors[`coBorrowers.${index}.state`]
                                    ? "border-red-500 bg-red-50"
                                    : "border-slate-300"
                                } bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm`}
                              >
                                <option value="">Select State</option>
                                {US_STATES.map((state) => (
                                  <option key={state} value={state}>
                                    {state}
                                  </option>
                                ))}
                              </select>

                              {errors[`coBorrowers.${index}.state`] && (
                                <p className="text-xs text-red-500 mt-1">
                                  {errors[`coBorrowers.${index}.state`]}
                                </p>
                              )}
                            </div>

                            <div className="md:col-span-2">
                              <label className="text-sm font-medium dark:text-slate-300">
                                Mailing Address (if different)
                              </label>
                              <input
                                value={
                                  formData.coBorrowers[index]?.mailingAddress
                                }
                                onChange={(e) =>
                                  updateCoBorrower(
                                    index,
                                    "mailingAddress",
                                    e.target.value,
                                  )
                                }
                                className={`text-sm mt-1 w-full px-4 py-1 rounded-md border focus:ring-2 focus:ring-blue-500/20 
          focus:border-blue-500 outline-none transition dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${
            errors[`coBorrowers.${index}.mailingAddress`]
              ? "border-red-500 bg-red-50"
              : "border-slate-300"
          }`}
                              />

                              {errors[
                                `coBorrowers.${index}.mailingAddress`
                              ] && (
                                <p className="text-xs text-red-500 mt-1">
                                  {
                                    errors[
                                      `coBorrowers.${index}.mailingAddress`
                                    ]
                                  }
                                </p>
                              )}
                            </div>
                          </div>

                          {/* ================= FINANCIAL DETAILS ================= */}
                          <div className="md:col-span-2 mt-6">
                            <h4 className="text-md font-semibold text-slate-700 mb-4 border-t pt-4 dark:text-white">
                              Financial Details
                            </h4>
                          </div>

                          {/* ================= FINANCIAL DETAILS ================= */}
                          <div className="md:col-span-2 mt-6">
                            {/* GRID-2 START */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {[
                                {
                                  label: "Current Market Value",
                                  key: "currentMarketValue",
                                },
                                {
                                  label: "Purchase Price",
                                  key: "purchasePrice",
                                },
                                {
                                  label: "Interest Rate (%)",
                                  key: "interestRate",
                                },
                                { label: "NOI (Annual)", key: "noi" },
                                { label: "Total Assets", key: "totalAssets" },
                                {
                                  label: "Total Liabilities",
                                  key: "totalLiabilities",
                                },
                              ].map((field) => (
                                <div key={field.key}>
                                  <label className="text-sm font-medium dark:text-slate-300">
                                    {field.label}{" "}
                                    <span className="text-red-500">*</span>
                                  </label>

                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={
                                      (formData.coBorrowers[index] as any)[
                                        field.key
                                      ]
                                    }
                                    onChange={(e) => {
                                      if (field.key === "interestRate") {
                                        updateCoBorrower(
                                          index,
                                          field.key,
                                          e.target.value,
                                        );
                                      } else {
                                        handleAmountChange(
                                          "coBorrower",
                                          field.key,
                                          e.target.value,
                                          index,
                                        );
                                      }
                                    }}
                                    className={`mt-1 w-full px-4 py-1 rounded-md border text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${
                                      errors[
                                        `coBorrowers.${index}.${field.key}`
                                      ]
                                        ? "border-red-500 bg-red-50"
                                        : "border-slate-300"
                                    }`}
                                  />

                                  {errors[
                                    `coBorrowers.${index}.${field.key}`
                                  ] && (
                                    <p className="text-xs text-red-500 mt-1">
                                      {
                                        errors[
                                          `coBorrowers.${index}.${field.key}`
                                        ]
                                      }
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                            {/* GRID-2 END */}
                          </div>
                        </div>
                      </>
                    );
                  })}
                </>
              )}
            </>
          )}

          {/* step — Financials / Loan Term */}
          {(baseSteps[currentStep] === "Financials" ||
            baseSteps[currentStep] === "Loan Term & Income") &&
            (useStandardSevenStepFlow ? (
              <div className="mt-6 relative z-10 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
                <h3 className="mb-1 inline-block border-b-2 border-[#2C92D5] pb-2 text-lg font-semibold dark:text-white">
                  Step 5: Financials
                </h3>

                <ResidentialFinancialsStep
                  financials={formData.financials}
                  onChange={updateFinancials}
                  annualDebtServiceDefault={totalAnnualDebtPayment}
                />
              </div>
            ) : (
              <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-6 bg-white dark:bg-slate-800">
                <h3 className="text-xl font-semibold mb-6 dark:text-white">
                  Loan Term & Property Income
                </h3>

                {/* Loan Term */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-2 dark:text-slate-300">
                    Loan Term Request <span className="text-red-500"> *</span>
                  </label>
                  <select
                    value={formData.loanTermIncome.loanTerm}
                    onChange={(e) =>
                      updateLoanTermIncome("loanTerm", e.target.value)
                    }
                    className={`w-full px-4 py-1 rounded-md border
border-slate-300 dark:border-slate-600
bg-white dark:bg-slate-900
text-slate-800 dark:text-slate-200
focus:ring-2 focus:ring-blue-500/20
focus:border-blue-500 outline-none text-sm ${
                      errors["loanTermIncome.loanTerm"]
                        ? "border-red-500 bg-red-50"
                        : "border-slate-300"
                    } bg-white focus:ring-2 focus:ring-blue-500/20
  focus:border-blue-500 outline-none transition`}
                  >
                    <option value="">Select Term</option>
                    <option value="12">12 Months</option>
                    <option value="24">24 Months</option>
                    <option value="36">36 Months</option>
                  </select>
                  {errors["loanTermIncome.loanTerm"] && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors["loanTermIncome.loanTerm"]}
                    </p>
                  )}
                </div>

                {/* Property Income Heading */}
                <h4 className="text-md font-semibold text-slate-700 mb-4 dark:text-slate-300">
                  Property Income
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Monthly Rent */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2 dark:text-slate-300">
                      Monthly Rent / Market Rent{" "}
                      <span className="text-red-500"> *</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formData.loanTermIncome.monthlyRent}
                      onChange={(e) =>
                        handleAmountChange(
                          "loanTermIncome",
                          "monthlyRent",
                          e.target.value,
                        )
                      }
                      className={`w-full px-4 py-1 rounded-md border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200  ${
                        errors["loanTermIncome.monthlyRent"]
                          ? "border-red-500 bg-red-50"
                          : "border-slate-300"
                      }
          focus:ring-2 focus:ring-blue-500/20
          focus:border-blue-500 outline-none transition text-sm`}
                    />
                    {errors["loanTermIncome.monthlyRent"] && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors["loanTermIncome.monthlyRent"]}
                      </p>
                    )}
                  </div>

                  {/* Gross Revenue Actual */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2 dark:text-slate-300">
                      Gross Revenue / Year (Actual){" "}
                      <span className="text-red-500"> *</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formData.loanTermIncome.grossRevenueActual}
                      onChange={(e) =>
                        handleAmountChange(
                          "loanTermIncome",
                          "grossRevenueActual",
                          e.target.value,
                        )
                      }
                      className={`w-full px-4 py-1 rounded-md border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200  ${
                        errors["loanTermIncome.grossRevenueActual"]
                          ? "border-red-500 bg-red-50"
                          : "border-slate-300"
                      }
          focus:ring-2 focus:ring-blue-500/20
          focus:border-blue-500 outline-none transition text-sm`}
                    />
                    {errors["loanTermIncome.grossRevenueActual"] && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors["loanTermIncome.grossRevenueActual"]}
                      </p>
                    )}
                  </div>

                  {/* Gross Revenue ProForma */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2 dark:text-slate-300">
                      Gross Revenue / Year (ProForma){" "}
                      <span className="text-red-500"> *</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formData.loanTermIncome.grossRevenueProforma}
                      onChange={(e) =>
                        handleAmountChange(
                          "loanTermIncome",
                          "grossRevenueProforma",
                          e.target.value,
                        )
                      }
                      className={`w-full px-4 py-1 rounded-md border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${
                        errors["loanTermIncome.grossRevenueProforma"]
                          ? "border-red-500 bg-red-50"
                          : "border-slate-300"
                      }
          focus:ring-2 focus:ring-blue-500/20
          focus:border-blue-500 outline-none transition text-sm`}
                    />
                    {errors["loanTermIncome.grossRevenueProforma"] && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors["loanTermIncome.grossRevenueProforma"]}
                      </p>
                    )}
                  </div>

                  {/* NOI Actual */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2 dark:text-slate-300">
                      Net Operating Income / Year (Actual){" "}
                      <span className="text-red-500"> *</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formData.loanTermIncome.noiActual}
                      onChange={(e) =>
                        handleAmountChange(
                          "loanTermIncome",
                          "noiActual",
                          e.target.value,
                        )
                      }
                      className={`w-full px-4 py-1 rounded-md border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${
                        errors["loanTermIncome.noiActual"]
                          ? "border-red-500 bg-red-50"
                          : "border-slate-300"
                      }
          focus:ring-2 focus:ring-blue-500/20
          focus:border-blue-500 outline-none transition text-sm`}
                    />
                    {errors["loanTermIncome.noiActual"] && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors["loanTermIncome.noiActual"]}
                      </p>
                    )}
                  </div>

                  {/* NOI ProForma */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2 dark:text-slate-300">
                      Net Operating Income / Year (ProForma){" "}
                      <span className="text-red-500"> *</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formData.loanTermIncome.noiProforma}
                      onChange={(e) =>
                        handleAmountChange(
                          "loanTermIncome",
                          "noiProforma",
                          e.target.value,
                        )
                      }
                      className={`w-full px-4 py-1 rounded-md border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${
                        errors["loanTermIncome.noiProforma"]
                          ? "border-red-500 bg-red-50"
                          : "border-slate-300"
                      }
          focus:ring-2 focus:ring-blue-500/20
          focus:border-blue-500 outline-none transition text-sm`}
                    />
                    {errors["loanTermIncome.noiProforma"] && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors["loanTermIncome.noiProforma"]}
                      </p>
                    )}
                  </div>
                </div>
                {/* ---------------- EXPENSES SECTION ---------------- */}
                <div className="mt-8">
                  <h4 className="text-md font-semibold text-slate-700 mb-4 dark:text-slate-300">
                    Expenses <span className="text-red-500"> *</span>
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Annual Property Taxes */}
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-2 dark:text-slate-300">
                        Annual Property Taxes{" "}
                        <span className="text-red-500"> *</span>
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formData.loanTermIncome.annualTaxes}
                        onChange={(e) =>
                          handleAmountChange(
                            "loanTermIncome",
                            "annualTaxes",
                            e.target.value,
                          )
                        }
                        className={`w-full px-4 py-1 rounded-md border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200  ${
                          errors["loanTermIncome.annualTaxes"]
                            ? "border-red-500 bg-red-50"
                            : "border-slate-300"
                        }
          focus:ring-2 focus:ring-blue-500/20
          focus:border-blue-500 outline-none transition text-sm`}
                      />
                      {errors["loanTermIncome.annualTaxes"] && (
                        <p className="text-xs text-red-500 mt-1">
                          {errors["loanTermIncome.annualTaxes"]}
                        </p>
                      )}
                    </div>

                    {/* Property in Flood Zone */}
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-2 dark:text-slate-300">
                        Property in Flood Zone{" "}
                        <span className="text-red-500"> *</span>
                      </label>

                      <div
                        className={`flex items-center gap-6 mt-2 dark:text-white ${
                          errors["loanTermIncome.floodZone"]
                            ? "border p-1 rounded-md border-red-500 bg-red-50"
                            : "border p-1 rounded-md border-slate-300 bg-white dark:bg-slate-900"
                        }`}
                      >
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            value="yes"
                            checked={
                              formData.loanTermIncome.floodZone === "yes"
                            }
                            onChange={(e) =>
                              updateLoanTermIncome("floodZone", e.target.value)
                            }
                          />
                          Yes
                        </label>

                        <label className="flex items-center gap-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ">
                          <input
                            type="radio"
                            value="no"
                            checked={formData.loanTermIncome.floodZone === "no"}
                            onChange={(e) =>
                              updateLoanTermIncome("floodZone", e.target.value)
                            }
                          />
                          No
                        </label>
                      </div>
                      {errors["loanTermIncome.floodZone"] && (
                        <p className="text-xs text-red-500 mt-1">
                          {errors["loanTermIncome.floodZone"]}
                        </p>
                      )}
                    </div>

                    {/* Annual Insurance Premium */}
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-2 dark:text-slate-300">
                        Annual Insurance Premium{" "}
                        <span className="text-red-500"> *</span>
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formData.loanTermIncome.insurancePremium}
                        onChange={(e) =>
                          handleAmountChange(
                            "loanTermIncome",
                            "insurancePremium",
                            e.target.value,
                          )
                        }
                        className={`w-full px-4 py-1 rounded-md border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200  ${
                          errors["loanTermIncome.insurancePremium"]
                            ? "border-red-500 bg-red-50"
                            : "border-slate-300"
                        }
          focus:ring-2 focus:ring-blue-500/20
          focus:border-blue-500 outline-none transition text-sm`}
                      />
                      {errors["loanTermIncome.insurancePremium"] && (
                        <p className="text-xs text-red-500 mt-1">
                          {errors["loanTermIncome.insurancePremium"]}
                        </p>
                      )}
                    </div>

                    {/* HOA Dues */}
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-2 dark:text-slate-300">
                        HOA Dues (If Applicable)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formData.loanTermIncome.hoaDues}
                        onChange={(e) =>
                          handleAmountChange(
                            "loanTermIncome",
                            "hoaDues",
                            e.target.value,
                          )
                        }
                        className={`w-full px-4 py-1 rounded-md border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200  ${
                          errors["loanTermIncome.hoaDues"]
                            ? "border-red-500 bg-red-50"
                            : "border-slate-300"
                        }
          focus:ring-2 focus:ring-blue-500/20
          focus:border-blue-500 outline-none transition text-sm`}
                      />
                      {errors["loanTermIncome.hoaDues"] && (
                        <p className="text-xs text-red-500 mt-1">
                          {errors["loanTermIncome.hoaDues"]}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

          {/* step — Documents */}
          {baseSteps[currentStep] === "Documents" &&
            useStandardSevenStepFlow && (
              <div className="mt-6 relative z-10 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
                <h3 className="mb-1 inline-block border-b-2 border-[#2C92D5] pb-2 text-lg font-semibold dark:text-white">
                  Step 6: Documents
                </h3>

                <ResidentialDocumentsStep
                  documents={pendingDocuments}
                  onChange={setPendingDocuments}
                  uploading={submitting}
                />
              </div>
            )}

          {/* step-6 — Review & Submit */}
          {isReviewStep && (
            <div className="mt-6 relative z-10 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
              <h3 className="mb-1 inline-block border-b-2 border-[#2C92D5] pb-2 text-lg font-semibold dark:text-white">
                Step 7: Review & Submit
              </h3>

              <ResidentialReviewStep
                sections={reviewSections}
                issues={reviewValidationIssues}
                documents={pendingDocuments}
                onEditStep={goToStep}
                onSubmit={handleReviewSubmit}
                submitting={submitting}
                creditAuthorizationConsent={creditAuthorizationConsent}
                onCreditAuthorizationConsentChange={
                  setCreditAuthorizationConsent
                }
              />
            </div>
          )}

          {!useStandardSevenStepFlow &&
            activeSectionIndex !== null &&
            dynamicSections[activeSectionIndex] && (
              <div
                className="
      border border-slate-200 dark:border-slate-700
      rounded-2xl p-6
      bg-white dark:bg-slate-800
      mt-6
      "
              >
                <h3 className="text-lg font-semibold mb-6 text-slate-800 dark:text-slate-200">
                  {toTitleCase(dynamicSections[activeSectionIndex].sectionName)}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {dynamicSections[activeSectionIndex].fields.map(
                    (field: any) => {
                      const errorKey = `dynamic.${field.fieldId}`;
                      const hasError = !!errors[errorKey];

                      return (
                        <div key={field.fieldId}>
                          <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                            {field.label}
                            {field.required && (
                              <span className="text-red-500"> *</span>
                            )}
                          </label>

                          {renderField(field, hasError)}

                          {hasError && (
                            <p className="text-xs text-red-500 mt-1">
                              {errors[errorKey]}
                            </p>
                          )}
                        </div>
                      );
                    },
                  )}
                </div>
              </div>
            )}

          {/* Footer */}
          <div className="flex justify-between pt-6 mt-6 border-t border-slate-200 dark:border-slate-700">
            {/* Back Button */}
            <button
              onClick={() => {
                if (currentStep > 0) {
                  goToStep(currentStep - 1);
                }
              }}
              disabled={currentStep === 0}
              className={`px-4 py-2 rounded-md border transition flex items-center justify-center gap-2 text-sm
  ${
    currentStep === 0
      ? "border-slate-200 text-slate-400 cursor-not-allowed"
      : "border-slate-300 text-slate-600 hover:bg-slate-100"
  }`}
            >
              <IoIosArrowBack />
              Back
            </button>

            {/* Save & Next Button */}
            {!isReviewStep && (
              <button
                onClick={() => {
                  if (currentStep === allSteps.length - 1) {
                    if (!validateAllStepsBeforeSubmit()) {
                      toast.error(
                        "Please complete all required fields before submitting",
                      );
                      return;
                    }
                    handleSubmitApplication();
                    return;
                  }

                  if (
                    currentStep === 2 &&
                    selectedProduct &&
                    dynamicSections.length === 0 &&
                    !useStandardSevenStepFlow
                  ) {
                    fetchSectionsByProduct();
                  }

                  goToStep(currentStep + 1);
                }}
                disabled={submitting}
                className="px-6 py-2 rounded-md bg-[#2C92D5] hover:bg-[#19679b] text-white 
     transition shadow-sm text-sm disabled:opacity-50"
              >
                {currentStep === allSteps.length - 1
                  ? submitting
                    ? mode === "update"
                      ? "Updating..."
                      : "Submitting..."
                    : mode === "update"
                      ? "Update Application"
                      : "Submit"
                  : "Next"}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default LoanApplication;
