// Type definitions for the LoanApplication page.
// These types are exported and consumed by sibling modules in this folder
// as well as by the main LoanApplication.tsx orchestrator.

import type { ReactNode } from "react";
import type { ResidentialBorrowerFields, RealEstateOwnedEntry } from "../../lib/residentialBorrower";
import type { ResidentialFinancials } from "../../lib/residentialFinancials";

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
}

export type LoanCategory =
  | "RESIDENTIAL_1_4"
  | "CRE_MULTIFAMILY"
  | "SBA_USDA"
  | "ABL"
  | "";

export type LoanApplicationMode = "create" | "update";

export type LoanApplicationPortal = "broker" | "loanOfficer";

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
  reviewCaptchaSlot?: ReactNode;
  recaptchaToken?: string | null;
};

// Re-export so consumers can grab the underlying borrower types from this module.
export type { ResidentialBorrowerFields, RealEstateOwnedEntry };
