import { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import { IoIosArrowBack } from "react-icons/io";
import { MdDeleteForever } from "react-icons/md";
import { useNavigate } from "react-router";
import { IoArrowBack } from "react-icons/io5";
import { Building2, HomeIcon, Landmark, Settings } from "lucide-react";
import LoanDateField from "../../../components/form/LoanDateField";

interface Borrower {
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

interface CoBorrower extends Borrower {
  id: number;

  // Financial
  currentMarketValue: string;
  purchasePrice: string;
  interestRate: string;
  noi: string;
  totalAssets: string;
  totalLiabilities: string;
}

export type FormDataType = {
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
    purchasePrice: string;
    purchaseDate: string;
    totalAssets: string;
    totalLiabilities: string;
    afterRepairValue: string;

    propertyType: string;
    subPropertyType: string;
    recourse: string;
    businessAddress: string;
    city: string;
    state: string;
    zip: string;
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
  };
}

export type LoanCategory =
  | "RESIDENTIAL_1_4"
  | "CRE_MULTIFAMILY"
  | "SBA_USDA"
  | "ABL"
  | "";

const US_STATES = [
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming",
];

const ALL_LOAN_PURPOSES = [
  "Purchase / Acquisition",
  "Refinance (Rate & Term)",
  "Cash Out Refinance",
  "Construction Completion",
  "Ground-up Construction",
  "Major Renovation (>50%)",
  "Tenant Improvements",
  "Infrastructure Development",
  "Purchase & Rehab",
  "Refinance & Rehab",
  "Portfolio Blanket",
  "Recapitalization",
  "Gap Finance",
  "Leverage Enhancement",
  "JV Equity",
  "Acquisition Bridge",
  "Affordable Housing",
  "Supplement Loan",
  "Partner Buyout",
  "Franchise Purchase",
  "Business Expansion",
  "Inventory Purchase",
  "Marketing / Expansion",
  "Debt Consolidation",
  "Seasonal Line",
  "New Equipment",
  "Used Equipment",
  "Refinance Existing Equipment",
  "Equipment Line",
  "Real Estate Acquisition",
  "Real Estate Construction",
  "Heavy Equipment",
  "Refinance (504 Debt)",
  "Business Acquisition",
  "Real Estate Purchase",
  "Equipment Purchase",
  "Working Capital",
  "Debt Refinancing",
  "New Equipment Purchase",
  "Used Equipment Purchase",
  "Sale-LeaseBack",
  "Refinance / Consolidation",
  "Single PO Funding",
  "PO Line of Credit",
  "International PO",
  "Government PO",
  "Invoice Factoring",
  "ABL Line",
  "Selective Receivable Finance",
  "International Receivables",
  "Supplier Finance Program",
  "Dynamic Discounting",
  "Reverse Factoring",
  "Supply Chain Finance",
];

export const CATEGORY_LOAN_TYPES: Record<
  Exclude<LoanCategory, "">,
  string[]
> = {
  /**
   * ==========================================
   * 1-4 Units Residential
   * ==========================================
   */
  RESIDENTIAL_1_4: [
    "BRIDGE_LOAN_1_TO_4_UNITS",
    "FIX_AND_FLIP_LOAN_1_TO_4_UNITS",
    "DSCR_LOAN_1_TO_4_UNITS",
    "CONSTRUCTION_LOAN_1_TO_4_UNITS",
    "RENTAL_PORTFOLIO",
  ],

  /**
   * ==========================================
   * CRE & Multifamily
   * ==========================================
   */
  CRE_MULTIFAMILY: [
    "BRIDGE_LOAN",
    "FIX_AND_FLIP_LOAN_1_TO_4_UNITS",
    "DSCR_LOAN_1_TO_4_UNITS",
    "CONSTRUCTION_LOAN",
    "RENTAL_PORTFOLIO",
    "CRE_PERMANENT_LOAN",
    "AGENCY_LOAN_MULTIFAMILY",
    "CMBS",
    "MEZZANINE_FINANCE",
  ],

  /**
   * ==========================================
   * SBA & USDA
   * ==========================================
   */
  SBA_USDA: [
    "SBA_7A_BUSINESS_ACQUISITION",
    "SBA_7A_WORKING_CAPITAL",
    "SBA_7A_EQUIPMENT_PURCHASE",
    "SBA_7A_REAL_ESTATE",
    "SBA_504_REAL_ESTATE_AND_EQUIPMENT",
    "USDA_BI",
  ],

  /**
   * ==========================================
   * Asset Based Lending
   * ==========================================
   */
  ABL: [
    "EQUIPMENT_FINANCE",
    "PURCHASE_ORDER_FINANCE",
    "ACCOUNTS_RECEIVABLE",
    "ACCOUNTS_RECEIVABLE_FINANCE",
    "ACCOUNTS_PAYABLE_FINANCE",
    "ASSET_BASED_LENDING",
  ],
};

const PRODUCT_LABELS: Record<string, string> = {
  // Residential
  BRIDGE_LOAN_1_TO_4_UNITS: "Bridge",
  FIX_AND_FLIP_LOAN_1_TO_4_UNITS: "Fix & Flip",
  DSCR_LOAN_1_TO_4_UNITS: "DSCR",
  CONSTRUCTION_LOAN_1_TO_4_UNITS: "Construction",
  RENTAL_PORTFOLIO: "Rental Portfolio",

  // CRE
  BRIDGE_LOAN: "Bridge",
  CONSTRUCTION_LOAN: "Construction",
  CRE_PERMANENT_LOAN: "CRE Permanent",
  AGENCY_LOAN_MULTIFAMILY: "Agency Multifamily",
  CMBS: "CMBS",
  MEZZANINE_FINANCE: "Mezz/Pref Equity",
  PREFERRED_EQUITY: "Preferred Equity",

  // SBA
  SBA_7A_BUSINESS_ACQUISITION: "SBA 7a Acquisition",
  SBA_7A_WORKING_CAPITAL: "SBA 7a Working Capital",
  SBA_7A_EQUIPMENT_PURCHASE: "SBA 7a Equipment",
  SBA_7A_REAL_ESTATE: "SBA 7a Real Estate",
  SBA_504_REAL_ESTATE_AND_EQUIPMENT: "SBA 504 Real Estate",
  USDA_BI: "USDA B&I",

  // ABL
  EQUIPMENT_FINANCE: "Equipment Finance",

  PURCHASE_ORDER_FINANCE: "Purchase Order Finance",

  ACCOUNTS_RECEIVABLE_FINANCE: "Accounts Receivable",
  ACCOUNTS_RECEIVABLE: "Accounts Receivable",
  ACCOUNTS_PAYABLE_FINANCE: "Accounts Payable",
};

/* ================= HELPERS ================= */
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

const OPTIONAL_LOAN_REQUEST_KEYS = new Set([
  "sellerFinancing",
  "sellerNoteAmount",
  "estimatedClosingDate",
  "brokerPoints",
  "amortization",
  "rateType",
  "interestRate",
  "recourse",
]);

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

const PURCHASE_DATE_WITH_AMORTIZATION_LOAN_TYPES = new Set([
  "DSCR_LOAN_1_TO_4_UNITS",
  "RENTAL_PORTFOLIO",
  "CRE_PERMANENT_LOAN",
  "AGENCY_LOAN_MULTIFAMILY",
  "CMBS",
  "SBA_7A_REAL_ESTATE",
  "SBA_504_REAL_ESTATE_AND_EQUIPMENT",
  "USDA_BI",
]);
const PURCHASE_DATE_WITH_AMORTIZATION_PURPOSES = new Set([
  "Purchase",
  "Purchase/Acquisition",
  "Purchase / Acquisition",
  "Purchase (Owner-Occupied)",
  "Purchase & Rehab",
  "Real Estate Acquisition",
  "Business Acquisition",
  "Real Estate Purchase",
  "Equipment Purchase",
]);
const ORIGINAL_PURCHASE_DATE_WITH_AMORTIZATION_PURPOSES = new Set([
  "Refinance (Rate & Term)",
  "Cash Out Refinance",
  "Refinance",
  "Refinance & Rehab",
  "Refinance (504 Debt)",
  "Debt Refinancing",
]);

const CONSTRUCTION_LOAN_TYPES = new Set([
  "CONSTRUCTION_LOAN",
  "CONSTRUCTION_LOAN_1_TO_4_UNITS",
]);

const MEZZANINE_LOAN_TYPES = new Set(["MEZZANINE_FINANCE"]);
const MEZZANINE_ACQUISITION_BRIDGE_PURPOSE = "Acquisition Bridge";

const isBridgePurchaseAcquisition = (
  product: string,
  purpose: string,
) =>
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

const isAccountsReceivableLoanRequestDate = (product: string, purpose: string) =>
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

const STATIC_FIELD_KEYS = [
  // Loan Request
  "purpose",
  "amount",
  "interestRate",
  "sellerFinancing",
  "sellerNoteAmount",
  "estimatedClosingDate",
  "rateType",
  "brokerPoints",
  "amortization",
  "currentMarketValue",
  "purchasePrice",
  "purchaseDate",
  "afterRepairValue",
  "totalAssets",
  "totalLiabilities",
  "propertyType",
  "subPropertyType",
  "recourse",
  "businessAddress",
  "city",
  "state",
  "zip",

  // Loan Term
  "loanTerm",
  "monthlyRent",
  "grossRevenueActual",
  "grossRevenueProforma",
  "noiActual",
  "noiProforma",
  "annualTaxes",
  "floodZone",
  "insurancePremium",
  "hoaDues",

  // Borrower
  "name",
  "entityName",
  "phone",
  "email",
  "employer",
  "dob",
  "ssn",
  "creditScore",
  "address",
  "mailingAddress",

  // Entity
  "legalName",
  "entityType",
  "dba",
  "formationDate",
  "yearsInBusiness",
];

const ENTITY_TYPE_OPTIONS = [
  { value: "C-Corp", label: "C-Corp" },
  { value: "S-Corp", label: "S-Corp" },
  { value: "LLC", label: "LLC" },
  { value: "Partnership", label: "Partnership" },
  { value: "Sole Proprietorship", label: "Sole Proprietorship" },
] as const;

export type LoanApplicationMode = "create" | "update";

export type LoanApplicationProps = {
  mode?: LoanApplicationMode;
  embedded?: boolean;
  editApplicationId?: string;
  initialFormData?: FormDataType;
  initialSelectedProduct?: string;
  initialSelectedCategory?: LoanCategory;
  initialDynamicFormData?: Record<string, any>;
  onUpdateSuccess?: (submissionId?: string) => void;
};

const LoanApplication = ({
  mode = "create",
  embedded = false,
  editApplicationId,
  initialFormData,
  initialSelectedProduct = "",
  initialSelectedCategory = "",
  initialDynamicFormData,
  onUpdateSuccess,
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
  const [applicationId, setApplicationId] = useState<string>("");
  const [productsMeta, setProductsMeta] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [selectedCategory, setSelectedCategory] = useState<LoanCategory>(
    initialSelectedCategory,
  );
  const navigate = useNavigate();

  const baseSteps = [
    "Loan Request",
    "Property Info",
    "Entity Info",
    "Borrower Info",
    "Loan Term & Income",
  ];

  const formatUSPhone = (value: string) => {
    // Remove non-digits
    const cleaned = value.replace(/\D/g, "").slice(0, 10);

    const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);

    if (!match) return cleaned;

    let formatted = "";

    if (match[1]) formatted += match[1];
    if (match[2]) formatted += "-" + match[2];
    if (match[3]) formatted += "-" + match[3];

    return formatted;
  };

  const formatSSN = (value: string) => {
    // Remove non-digits
    const cleaned = value.replace(/\D/g, "").slice(0, 9);

    const match = cleaned.match(/^(\d{0,3})(\d{0,2})(\d{0,4})$/);

    if (!match) return cleaned;

    let formatted = "";

    if (match[1]) formatted += match[1];
    if (match[2]) formatted += "-" + match[2];
    if (match[3]) formatted += "-" + match[3];

    return formatted;
  };

  const ZIP_REGEX = /^\d{5}(-\d{4})?$/;

  const formatCurrency = (value: string) => {
    // Remove everything except digits
    const cleaned = value.replace(/\D/g, "");

    if (!cleaned) return "";

    return Number(cleaned).toLocaleString("en-US");
  };

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

  const allSteps = [
    ...baseSteps,
    ...dynamicSections.map((section) => toTitleCase(section.sectionName)),
  ];

  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<FormDataType>(
    initialFormData || {
    borrower: {
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
    },
    coBorrowers: [],
      loanRequest: {
        purpose: "",
        amount: "",
        interestRate: "",
        sellerFinancing: "no",
        sellerNoteAmount: "",
        estimatedClosingDate: "",
        rateType: "FIXED",
        brokerPoints: "",
        amortization: "",
        currentMarketValue: "",
      purchasePrice: "",
      purchaseDate: "",
      totalAssets: "",
      totalLiabilities: "",
      afterRepairValue: "",

      propertyType: "",
      subPropertyType: "",
      recourse: "",
      businessAddress: "",
      city: "",
      state: "",
      zip: "",
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
    },
  }
  );

  const [loanProducts, setLoanProducts] = useState<string[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const handleAddCoBorrower = () => {
    const newId = Date.now();

    setFormData((prev) => ({
      ...prev,
      coBorrowers: [
        ...prev.coBorrowers,
        {
          id: newId,
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

          // Financial
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

  const updateLoanRequest = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      loanRequest: {
        ...prev.loanRequest,
        [field]: value,
      },
    }));

    setErrors((prev) => {
      const updated = { ...prev };
      delete updated[`loanRequest.${field}`];
      return updated;
    });
  };

  const updateLoanTermIncome = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      loanTermIncome: {
        ...prev.loanTermIncome,
        [field]: value,
      },
    }));

    setErrors((prev) => {
      const updated = { ...prev };
      delete updated[`loanTermIncome.${field}`];
      return updated;
    });
  };

  const Stat = ({ label, value }: { label: string; value: string }) => (
    <div>
      <p className="text-xs text-slate-500 uppercase">{label}</p>
      <p className="text-[14px] font-semibold text-[#2C92D5]">{value}</p>
    </div>
  );

  // const handleStepClick = (index: number) => {
  //   if (index > currentStep) {
  //     const isValid = validateCurrentStep();
  //     if (!isValid) return;
  //   }

  //   goToStep(index);
  // };

  const activeProduct = productsMeta.find(
    (p: any) => p.loanProductCode === selectedProduct,
  );

  const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}$/;

  const PHONE_REGEX = /^\d{3}-\d{3}-\d{4}$/;

  const validateFieldValue = (
    key: string,
    value: any,
    required: boolean = true,
  ) => {
    const trimmed = typeof value === "string" ? value.trim() : value;

    // Required
    if (required) {
      const isEmpty =
        trimmed === undefined ||
        trimmed === null ||
        trimmed === "" ||
        (Array.isArray(trimmed) && trimmed.length === 0);

      if (isEmpty) return "This field is required";
    }

    // Email
    if (key.toLowerCase().includes("email")) {
      if (trimmed && !EMAIL_REGEX.test(trimmed)) {
        return "Enter a valid email address";
      }
    }

    // Phone
    if (key.toLowerCase().includes("phone")) {
      if (trimmed && !PHONE_REGEX.test(trimmed)) {
        return "Enter a valid US phone number";
      }
    }

    // SSN
    if (key.toLowerCase().includes("ssn")) {
      const SSN_REGEX = /^\d{3}-\d{2}-\d{4}$/;
      if (trimmed && !SSN_REGEX.test(trimmed)) {
        return "Enter valid SSN (XXX-XX-XXXX)";
      }
    }

    // ZIP Code
if (key.toLowerCase() === "zip") {
  if (trimmed && !ZIP_REGEX.test(trimmed)) {
    return "Enter a valid US ZIP Code (12345 or 12345-6789)";
  }
}

    // Amount fields validation
    const amountKeys = [
      "amount",
      "sellerNoteAmount",
      "currentMarketValue",
      "purchasePrice",
      "afterRepairValue",
      "totalAssets",
      "totalLiabilities",
      "monthlyRent",
      "grossRevenueActual",
      "grossRevenueProforma",
      "noiActual",
      "noiProforma",
      "annualTaxes",
      "insurancePremium",
      "hoaDues",
      "noi",
    ];

    if (amountKeys.includes(key)) {
      const numeric = parseFloat(String(trimmed).replace(/,/g, ""));

      if (required && (!numeric || numeric <= 0)) {
        return "Amount must be greater than 0";
      }

      if (numeric < 0) {
        return "Amount cannot be negative";
      }
    }

    if (key === "interestRate") {
      const numeric = parseFloat(trimmed);
      if (numeric < 0) {
        return "Interest rate cannot be negative";
      }
    }

    if (key === "creditScore") {
      const score = parseInt(trimmed);
      if (score < 300 || score > 850) {
        return "Credit score must be between 300 and 850";
      }
    }

    return "";
  };

  const validateCurrentStep = () => {
    const newErrors: Record<string, string> = {};

    const checkObject = (obj: Record<string, any>, prefix: string) => {
      Object.entries(obj).forEach(([key, value]) => {
        if (
          key === "mailingAddress" ||
           key === "id" ||
            key === "dba" ||
      key === "hoaDues"
          ) return;

        const error = validateFieldValue(key, value, true);

        if (error) {
          newErrors[`${prefix}.${key}`] = error;
        }
      });
    };

    /* ================= STEP 0 ================= */
    if (currentStep === 0) {
      if (!selectedCategory) {
        newErrors["category"] = "Category is required";
      }

      if (!selectedProduct) {
        newErrors["selectedProduct"] = "Program selection is required";
      }

      if (selectedProduct) {
        if (!formData.loanRequest.purpose?.trim()) {
          newErrors["loanRequest.purpose"] = "Loan purpose is required";
        }

        const amount = toNumber(formData.loanRequest.amount);
        if (!amount || amount <= 0) {
          newErrors["loanRequest.amount"] =
            "Requested loan amount must be greater than 0";
        }

        if (
          isLoanRequestPurchaseDateField(
            selectedProduct,
            formData.loanRequest.purpose,
          ) &&
          !formData.loanRequest.purchaseDate?.trim()
        ) {
          newErrors["loanRequest.purchaseDate"] = isLoanRequestOriginalPurchaseDate(
            selectedProduct,
            formData.loanRequest.purpose,
          )
            ? "Original purchase date is required"
            : "Purchase date is required";
        }
      }
    }

    /* ================= STEP 1 ================= */
    if (currentStep === 1) {
      Object.entries(formData.loanRequest).forEach(([key, value]) => {
        if (OPTIONAL_LOAN_REQUEST_KEYS.has(key)) return;
        if (
          shouldHidePropertyPurchaseDate(
            selectedProduct,
            formData.loanRequest.purpose,
          ) &&
          key === "purchaseDate"
        ) {
          return;
        }

        const error = validateFieldValue(key, value, true);
        if (error) {
          newErrors[`loanRequest.${key}`] = error;
        }
      });

      const assets = toNumber(formData.loanRequest.totalAssets);
      const liabilities = toNumber(formData.loanRequest.totalLiabilities);

      if (assets <= 0) {
        newErrors["loanRequest.totalAssets"] =
          "Total Assets must be greater than 0";
      }

      if (liabilities < 0) {
        newErrors["loanRequest.totalLiabilities"] =
          "Liabilities cannot be negative";
      }

      if (!formData.loanRequest.businessAddress) {
        newErrors["loanRequest.businessAddress"] = "Address is required";
      }

      if (!formData.loanRequest.city) {
        newErrors["loanRequest.city"] = "City is required";
      }

      if (!formData.loanRequest.state) {
        newErrors["loanRequest.state"] = "State is required";
      }

      if (!formData.loanRequest.zip) {
        newErrors["loanRequest.zip"] = "ZIP is required";
      }
    }

    /* ================= STEP 2 ================= */
    if (currentStep === 2) {
      checkObject(formData.entity, "entity");

      const years = Number(formData.entity.yearsInBusiness);

      if (years < 0) {
        newErrors["entity.yearsInBusiness"] =
          "Years in business cannot be negative";
      }
    }

    /* ================= STEP 3 ================= */
    if (currentStep === 3) {
      checkObject(formData.borrower, "borrower");

      formData.coBorrowers.forEach((b, index) => {
        // Personal Details
        checkObject(
          {
            name: b.name,
            entityName: b.entityName,
            phone: b.phone,
            email: b.email,
            employer: b.employer,
            dob: b.dob,
            ssn: b.ssn,
            creditScore: b.creditScore,
            address: b.address,
            city: b.city,
            state: b.state,
          },
          `coBorrowers.${index}`,
        );

        // Financial Details
        const financialFields = [
          "currentMarketValue",
          "purchasePrice",
          "interestRate",
          "noi",
          "totalAssets",
          "totalLiabilities",
        ];

        financialFields.forEach((field) => {
          const value = (b as any)[field];
          const error = validateFieldValue(field, value, true);

          if (error) {
            newErrors[`coBorrowers.${index}.${field}`] = error;
          }
        });
      });
    }

    /* ================= STEP 4 ================= */
    if (currentStep === 4) {
      checkObject(formData.loanTermIncome, "loanTermIncome");

      const loanTerm = Number(formData.loanTermIncome.loanTerm);
      if (loanTerm && loanTerm <= 0) {
        newErrors["loanTermIncome.loanTerm"] =
          "Loan term must be greater than 0";
      }

      const noi = Number(formData.loanTermIncome.noiActual);
      if (noi && noi < 0) {
        newErrors["loanTermIncome.noiActual"] = "NOI cannot be negative";
      }
    }
    /* ================= DYNAMIC STEP ================= */
    if (activeSectionIndex !== null && dynamicSections[activeSectionIndex]) {
      const visibleFields = dynamicSections[activeSectionIndex]?.fields.filter(
        (field: any) => {
          const normalized = (field.fieldKey || field.label || "")
            .toLowerCase()
            .replace(/\s+/g, "");

          return !STATIC_FIELD_KEYS.map((k) =>
            k.toLowerCase().replace(/\s+/g, ""),
          ).includes(normalized);
        },
      );

      visibleFields.forEach((field: any) => {
        const value = dynamicFormData[field.fieldId];

        const error = validateFieldValue(
          field.label || field.fieldKey,
          value,
          field.required,
        );

        if (error) {
          newErrors[`dynamic.${field.fieldId}`] = error;
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const updateEntity = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      entity: {
        ...prev.entity,
        [field]: value,
      },
    }));

    setErrors((prev) => {
      const updated = { ...prev };
      delete updated[`entity.${field}`];
      return updated;
    });
  };

  const handleSubmitApplication = async () => {
    try {
      if (!activeProduct) {
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

      const fieldsMap = new Map<
        string,
        { value: any; fieldId?: string }
      >();

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

      /* ================= LOAN REQUEST ================= */

      addField("loanProductCode", selectedProduct);
      addField("amountRequested", toNumber(formData.loanRequest.amount));
      addField("interestRate", formData.loanRequest.interestRate);
      addField("purpose", formData.loanRequest.purpose);
      addField("propertyType", formData.loanRequest.propertyType);
      addField("subPropertyType", formData.loanRequest.subPropertyType);
      addField("recourse", formData.loanRequest.recourse);
      addField("sellerFinancing", formData.loanRequest.sellerFinancing);
      addField("sellerNoteAmount", toNumber(formData.loanRequest.sellerNoteAmount));
      addField("estimatedClosingDate", formData.loanRequest.estimatedClosingDate);
      addField("rateType", formData.loanRequest.rateType);
      addField("brokerPoints", formData.loanRequest.brokerPoints);
      addField("amortization", formData.loanRequest.amortization);

      /* ================= PROPERTY LOCATION ================= */

      addField("propertyAddress", formData.loanRequest.businessAddress);
      addField("propertyCity", formData.loanRequest.city);
      addField("propertyState", formData.loanRequest.state);
      addField("propertyZip", formData.loanRequest.zip?.replace(/\D/g, ""));
      addField("propertyCountry", "USA");

      /* ================= LOAN TERM ================= */

      addField("loanTerm", formData.loanTermIncome.loanTerm);
      addField("noiActual", formData.loanTermIncome.noiActual);

      // entity fields
      addField("entityLegalName", formData.entity.legalName);
      addField("entityType", formData.entity.entityType);
      addField("dba", formData.entity.dba);
      addField("formationDate", formData.entity.formationDate);
      addField("yearsInBusiness", formData.entity.yearsInBusiness);

      // loan request
      addField(
        "currentMarketValue",
        toNumber(formData.loanRequest.currentMarketValue),
      );
      addField(
        "afterRepairValue",
        toNumber(formData.loanRequest.afterRepairValue),
      );
      addField("purchasePrice", toNumber(formData.loanRequest.purchasePrice));
      addField("purchaseDate", formData.loanRequest.purchaseDate);
      addField("totalAssets", borrowerAssets);
      addField("totalLiabilities", borrowerLiabilities);

      // loanTermIncome
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

      /* ================= CO BORROWERS ================= */

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

        const coAnnualDebt = calculateAnnualDebtService(
          coLoanAmount,
          coInterest,
          termMonths,
        );

        const coDscr = coAnnualDebt > 0 && coNoi > 0 ? coNoi / coAnnualDebt : 0;

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

      /* ================= FINAL PAYLOAD ================= */

      const payload = {
        applicationId,
        applicationProductId: activeProduct.productId,
        fields: Array.from(fieldsMap.entries()).map(
          ([fieldKey, { value, fieldId }]) => ({
            fieldKey,
            value,
            ...(fieldId ? { fieldId } : {}),
          }),
        ),
      };

      const token = sessionStorage.getItem("loan_officer_token");

      if (mode === "update" && editApplicationId) {
        const response = await fetch(
          `${API_BASE}/loanofficer/applications/${editApplicationId}/edit`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ fields: payload.fields }),
          },
        );

        const result = await response.json();

        if (!response.ok || result.success !== true) {
          throw new Error(result.message || "Update failed");
        }

        toast.success("Application Updated Successfully");
        onUpdateSuccess?.(result.data?.submissionId);
        if (!embedded) {
          navigate("/loan-officer/loan-pipeline");
        }
        return;
      }

      console.log("Submitting Payload:", payload);

      const response = await fetch(`${API_BASE}/loanofficer/applications/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || result.success !== true) {
        throw new Error(result.message || "Submission failed");
      }

      toast.success("Application Submitted Successfully"); 
      navigate("/loan-officer/loan-pipeline"); 
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

        const response = await fetch(
          `${API_BASE}/api/public/broker/applications/active`,
        );

        const result = await response.json();

        const products = result?.data?.products || [];

        setProductsMeta(products);
        setApplicationId(result?.data?.applicationId || "");
        // const productCodes = products.map(
        //   (product: any) => product.loanProductCode,
        // );

        setLoanProducts([]);
      } catch (error) {
        console.error("Error fetching loan products:", error);
      } finally {
        setLoadingProducts(false);
      }
    };

    fetchLoanProducts();
  }, []);

  const fetchSectionsByProduct = async (productCode: string) => {
    try {
      const response = await fetch(
        `${API_BASE}/api/public/broker/applications/active`,
      );

      const result = await response.json();

      const products = result?.data?.products || [];

      const matchedProduct = products.find(
        (p: any) => p.loanProductCode === productCode,
      );

      const sections = matchedProduct?.sections || [];

      const normalizeKey = (key: string = "") =>
        key.toLowerCase().replace(/\s+/g, "");

      const staticKeysSet = new Set(STATIC_FIELD_KEYS.map(normalizeKey));

      const cleanedSections = sections.map((section: any) => ({
        ...section,
        fields: (section.fields || []).filter((field: any) => {
          const fieldKey = normalizeKey(field.fieldKey || field.label || "");

          return !staticKeysSet.has(fieldKey);
        }),
      }));

      const sortedSections = [...cleanedSections].sort(
        (a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0),
      );

      setDynamicSections(sortedSections);
    } catch (error) {
      console.error("Error fetching sections:", error);
    }
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

  const toNumber = (value: string) => {
    const cleaned = value.replace(/,/g, "");
    return parseFloat(cleaned) || 0;
  };

  const borrowerAssets = toNumber(formData.loanRequest.totalAssets || "0");
  const borrowerLiabilities = toNumber(
    formData.loanRequest.totalLiabilities || "0",
  );

  const netWorth = borrowerAssets - borrowerLiabilities;

  const calculateAnnualDebtService = (
    loanAmount: number,
    interestRate: number,
    termMonths: number,
  ) => {
    if (!loanAmount || !termMonths || termMonths <= 0) return 0;
    if (interestRate < 0) return 0;

    const monthlyRate = interestRate / 100 / 12;

    if (monthlyRate === 0) {
      return (loanAmount / termMonths) * 12;
    }

    const emi =
      (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
      (Math.pow(1 + monthlyRate, termMonths) - 1);

    return emi * 12;
  };

  const loanAmount = toNumber(formData.loanRequest.amount);
  const purchasePrice = toNumber(formData.loanRequest.purchasePrice);
  const marketValue = toNumber(formData.loanRequest.currentMarketValue);

  const ltv =
    marketValue > 0 ? ((loanAmount / marketValue) * 100).toFixed(2) : "—";

  const ltc =
    purchasePrice > 0 ? ((loanAmount / purchasePrice) * 100).toFixed(2) : "—";

  const afterRepairValue = toNumber(formData.loanRequest.afterRepairValue);

  const arv =
    afterRepairValue > 0
      ? ((loanAmount / afterRepairValue) * 100).toFixed(2)
      : "—";

  const interestRate = toNumber(formData.loanRequest.interestRate);
  const termMonths = toNumber(formData.loanTermIncome.loanTerm);
  const noiActual = toNumber(formData.loanTermIncome.noiActual) * 12;

  const annualDebtService = calculateAnnualDebtService(
    loanAmount,
    interestRate,
    termMonths,
  );

  const dscr =
    annualDebtService > 0 && noiActual > 0
      ? (noiActual / annualDebtService).toFixed(2)
      : "—";

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
    setCurrentStep(stepIndex);

    if (stepIndex >= baseSteps.length) {
      setActiveSectionIndex(stepIndex - baseSteps.length);
    } else {
      setActiveSectionIndex(null);
    }
  };

  useEffect(() => {
    if (selectedProduct) {
      fetchSectionsByProduct(selectedProduct);
    }
  }, [selectedProduct]);

  useEffect(() => {
    if (!selectedCategory) return;

    const allowedProducts = CATEGORY_LOAN_TYPES[selectedCategory] || [];

    const filteredProducts = productsMeta
      .filter((p: any) => allowedProducts.includes(p.loanProductCode))
      .sort(
        (a: any, b: any) =>
          allowedProducts.indexOf(a.loanProductCode) -
          allowedProducts.indexOf(b.loanProductCode),
      );

    setLoanProducts(filteredProducts.map((p: any) => p.loanProductCode));

    if (mode === "update" && initialSelectedProduct) {
      setSelectedProduct((prev) =>
        allowedProducts.includes(initialSelectedProduct)
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

    // Clear error instantly
    setErrors((prev) => {
      const updated = { ...prev };
      delete updated[`borrower.${field}`];
      return updated;
    });
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

    // Clear error
    setErrors((prev) => {
      const updated = { ...prev };
      delete updated[`coBorrowers.${index}.${field}`];
      return updated;
    });
  };

  const PROPERTY_TYPE_MAP: Record<string, string[]> = {
    MULTIFAMILY: [
      "Garden",
      "Mid-Rise",
      "High-Rise",
      "Senior Housing",
      "Student Housing",
      "Affordable Housing",
    ],

    OFFICE: [
      "Central Business District",
      "Medical",
      "Creative",
      "Government",
      "Suburban",
    ],

    RETAIL: [
      "Strip Plaza",
      "Mall",
      "Single-Tenant",
      "Restaurant",
      "Automotive",
    ],

    INDUSTRIAL: [
      "Warehouse",
      "Manufacturing",
      "Flex",
      "Data Center",
      "Cold Storage",
    ],

    SPECIAL_PURPOSE: [
      "Car Wash",
      "Gas Station",
      "Self Storage",
      "Hospital",
      "School",
    ],

    LAND: ["Raw", "Entitled", "Developed", "Agriculture"],

    MIXED_USE: ["Horizontal", "Vertical", "Live & Work"],
  };

  const LOAN_PURPOSE_MAP: Record<string, string[]> = {
    /* 1️⃣ Bridge Loan */
    BRIDGE_LOAN: [
      "Purchase/Acquisition",
      "Refinance (Rate & Term)",
      "Cash Out Refinance",
      "Construction Completion",
    ],

    /* 2️⃣ Construction Loan */
    CONSTRUCTION_LOAN: [
      "Ground-up Construction",
      "Major Renovation (>50% of value)",
      "Tenant Improvements",
      "Infrastructure Development",
    ],

    /* 3️⃣ Fix & Flip */
    FIX_AND_FLIP_LOAN_1_TO_4_UNITS: ["Purchase & Rehab", "Refinance & Rehab"],

    MEZZANINE_FINANCE: [
      "Gap Finance",
      "Leverage Enhancement",
      "JV Equity",
      "Acquisition Bridge",
      "Construction Project",
    ],

    PREFERRED_EQUITY: ["Acquisition Bridge", "Recapitalization"],

    /* 4️⃣ DSCR */
    DSCR_LOAN_1_TO_4_UNITS: [
      "Purchase",
      "Refinance (Rate & Term)",
      "Cash Out Refinance",
      "Portfolio Blanket",
    ],

    BRIDGE_LOAN_1_TO_4_UNITS: [
      "Purchase/Acquisition",
      "Refinance (Rate & Term)",
      "Cash Out Refinance",
      "Construction Completion",
    ],

    CONSTRUCTION_LOAN_1_TO_4_UNITS: [
      "Ground-up Construction",
      "Major Renovation (>50% of value)",
      "Tenant Improvements",
      "Infrastructure Development",
    ],

    /* 5️⃣ CRE Permanent */
    CRE_PERMANENT_LOAN: ["Purchase", "Refinance", "Recapitalization"],

    RENTAL_PORTFOLIO: [
      "Purchase",
      "Refinance (Rate & Term)",
      "Cash Out Refinance",
    ],

    /* 6️⃣ Mezz Finance / Pref Equity */
    // MEZZ_FINANCE_PREF_EQUITY: [
    //   "Gap Finance",
    //   "Leverage Enhancement",
    //   "JV Equity",
    //   "Acquisition Bridge",
    // ],

    /* 7️⃣ Agency Loan */
    AGENCY_LOAN_MULTIFAMILY: [
      "Purchase/Acquisition",
      "Cash Out Refinance",
      "Affordable Housing",
      "Supplement Loan",
    ],

    /* 8️⃣ CMBS */
    CMBS: [
      "Purchase/Acquisition",
      "Refinance (Rate & Term)",
      "Cash Out Refinance",
    ],

    /* 9️⃣ SBA 7a - Business Acquisition */
    SBA_7A_BUSINESS_ACQUISITION: [
      "Purchase/Acquisition",
      "Partner Buyout",
      "Franchise Purchase",
      "Business Expansion",
    ],

    /* 🔟 SBA 7a - Working Capital */
    SBA_7A_WORKING_CAPITAL: [
      "Inventory Purchase",
      "Marketing/Expansion",
      "Debt Consolidation",
      "Seasonal Line",
    ],

    /* 11️⃣ SBA 7a - Equipment Purchase */
    SBA_7A_EQUIPMENT_PURCHASE: [
      "New Equipment",
      "Used Equipment",
      "Refinance Existing Equipment",
      "Equipment Line",
    ],

    /* 12️⃣ SBA 7a - Real Estate */
    SBA_7A_REAL_ESTATE: [
      "Purchase (Owner-Occupied)",
      "Construction",
      "Refinance",
      "New Construction",
      "Purchase & Rehab",
      "Refinance & Rehab",
    ],

    /* 13️⃣ SBA 504 */
    SBA_504_REAL_ESTATE_AND_EQUIPMENT: [
      "Real Estate Acquisition",
      "Real Estate Construction",
      "Heavy Equipment",
      "Refinance (504 Debt)",
    ],

    /* 14️⃣ USDA B&I */
    USDA_BI: [
      "Business Acquisition",
      "Real Estate Purchase",
      "Equipment Purchase",
      "Working Capital",
      "Debt Refinancing",
    ],

    /* 15️⃣ Equipment Finance */
    EQUIPMENT_FINANCE: [
      "New Equipment Purchase",
      "Used Equipment Purchase",
      "Sale-Leaseback",
      "Refinance/Consolidation",
    ],

    /* 16️⃣ Purchase Order Finance */
    PURCHASE_ORDER_FINANCE: [
      "Single PO Funding",
      "PO Line of Credit",
      "International PO",
      "Government PO",
    ],

    /* 17️⃣ Accounts Receivable Finance */
    ACCOUNTS_RECEIVABLE_FINANCE: [
      "Invoice Factoring",
      "ABL Line",
      "Selective Receivable Finance",
      "International Receivables",
    ],

    ACCOUNTS_RECEIVABLE: [
      "Invoice Factoring",
      "ABL Line",
      "Selective Receivable Finance",
      "International Receivables",
    ],

    /* 18️⃣ Accounts Payable Finance */
    ACCOUNTS_PAYABLE_FINANCE: [
      "Supplier Finance Program",
      "Dynamic Discounting",
      "Reverse Factoring",
      "Supply Chain Finance",
    ],
  };

  const loanPurposeOptions = LOAN_PURPOSE_MAP[selectedProduct] || [];

  const purposesToShow =
    loanPurposeOptions && loanPurposeOptions.length > 0
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
    PRODUCT_LABELS[selectedProduct] || selectedProduct.replace(/_/g, " ");

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
              : "w-full sticky top-[1px] z-30 bg-slate-50 dark:bg-slate-900 pb-2"
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
                Back to Loan Pipeline
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
          <div className="mb-2 flex flex-wrap gap-1.5">
            {allSteps.map((step, index) => (
              <button
                key={step}
                type="button"
                // onClick={() => handleStepClick(index)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition
        ${
          index === currentStep
            ? "bg-[#2C92D5] text-white shadow"
            : index < currentStep
              ? "bg-green-500 text-white hover:bg-green-600"
              : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300  dark:hover:bg-slate-600"
        }`}
              >
                {step}
              </button>
            ))}
          </div>

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

            <div className="grid grid-cols-2 md:grid-cols-5 gap-6 text-center">
              <Stat label="LTV %" value={ltv !== "—" ? `${ltv}%` : "—"} />
              <Stat label="LTC %" value={ltc !== "—" ? `${ltc}%` : "—"} />
              <Stat label="ARV %" value={arv !== "—" ? `${arv}%` : "—"} />
              <Stat label="DSCR" value={dscr !== "—" ? dscr : "—"} />
              <Stat label="Net Worth" value={`$${netWorth.toLocaleString()}`} />
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="w-full mx-auto">
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

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {categories.map((category: LoanCategory) => {
                    const Icon = CATEGORY_ICONS[category] || Settings;

                    return (
                      <button
                        key={category}
                        type="button"
                        disabled={mode === "update"}
                        onClick={() => setSelectedCategory(category)}
                        className={`flex-shrink-0 flex flex-col items-center justify-center gap-2 
        w-full h-[110px] rounded-2xl border transition-all text-center
        disabled:cursor-not-allowed disabled:opacity-60
        
        ${
          selectedCategory === category
            ? "bg-[#2C92D5] text-white border-[#2C92D5] shadow-md"
            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:shadow-md"
        }`}
                      >
                        <Icon
                          size={28}
                          className={
                            selectedCategory === category
                              ? "text-white"
                              : "text-[#2C92D5]"
                          }
                        />

                        <span className="text-sm font-semibold leading-tight px-2">
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
                    disabled={mode === "update"}
                    onChange={(e) => {
                      setSelectedProduct(e.target.value);
                      updateLoanRequest("purpose", "");
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
                    <option value="">Select loan type</option>

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
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                        Loan Purpose <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.loanRequest.purpose}
                        onChange={(e) => {
                          const purpose = e.target.value;
                          updateLoanRequest("purpose", purpose);
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
                        className={`w-full px-4 py-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm ${
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

                    <div className="md:col-span-2 flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-3">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        Seller Financing?
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={formData.loanRequest.sellerFinancing === "yes"}
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
                      <div className="md:col-span-2">
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
                              const formatted = formatCurrency(e.target.value);
                              updateLoanRequest("sellerNoteAmount", formatted);
                            }}
                            placeholder="0"
                            className="w-full pl-7 pr-4 py-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                          />
                        </div>
                      </div>
                    )}

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

                    <div>
                      <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                        Estimated Closing Date
                      </label>
                      <LoanDateField
                        value={formData.loanRequest.estimatedClosingDate}
                        onChange={(val) =>
                          updateLoanRequest("estimatedClosingDate", val)
                        }
                      />
                    </div>

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
                        className="w-full px-4 py-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                      />
                    </div>

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
                      </select>
                    </div>

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
                        className="w-full px-4 py-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                      />
                    </div>

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

                    <div>
                      <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                        Broker Points (%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.loanRequest.brokerPoints}
                        onChange={(e) =>
                          updateLoanRequest("brokerPoints", e.target.value)
                        }
                        placeholder="e.g. 1.0"
                        className="w-full px-4 py-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                      />
                    </div>

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
                  </>
                )}
              </div>
            </div>
          )}

          {/* step-1 */}
          {currentStep === 1 && (
            <div className="mt-6 relative z-10 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 bg-white dark:bg-slate-800">
              <h3 className="text-lg font-semibold mb-6 dark:text-white">
                Step 2: Property Info
              </h3>

              {/* ================= LOAN CATEGORY ================= */}
              {/* <div className="mb-6">
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-3">
                  Select a Loan Category <span className="text-red-500">*</span>
                </label>

                <div className="flex gap-4 overflow-x-auto pb-2">
                  {categories.map((category) => {
                    const Icon = CATEGORY_ICONS[category] || Settings;

                    return (
                      <button
                        key={category}
                        type="button"
                        onClick={() => setSelectedCategory(category)}
                        className={`flex-shrink-0 flex flex-col items-center justify-center gap-2 
        w-[160px] h-[100px] rounded-2xl border transition-all text-center
        
        ${
          selectedCategory === category
            ? "bg-[#2C92D5] text-white border-[#2C92D5] shadow-md"
            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:shadow-md"
        }`}
                      >
                        <Icon size={26} />

                        <span className="text-xs font-semibold leading-tight px-2">
                          {CATEGORY_LABELS[category] || category}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div> */}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                    onChange={(val) => updateLoanRequest("purchaseDate", val)}
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
                    onChange={(e) => updateLoanRequest("city", e.target.value)}
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
                    onChange={(e) => updateLoanRequest("state", e.target.value)}
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
    let value = e.target.value
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
            </div>
          )}

          {/* step 2 */}
          {currentStep === 2 && (
            <div
              className="border border-slate-200 dark:border-slate-700 
rounded-2xl p-6 bg-white dark:bg-slate-800"
            >
              {/* HEADER */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold dark:text-white">
                  Business / Entity Information
                </h3>
              </div>

              {/* GRID */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Legal Name */}
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    Legal Business / Entity Name{" "}
                    <span className="text-red-500">*</span>
                  </label>

                  <input
                    value={formData.entity.legalName}
                    onChange={(e) => updateEntity("legalName", e.target.value)}
                    className={`mt-1 w-full px-4 py-1 rounded-md border 
          dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200
          ${
            errors["entity.legalName"]
              ? "border-red-500 bg-red-50"
              : "border-slate-300"
          }
          focus:ring-2 focus:ring-blue-500/20 
          focus:border-blue-500 outline-none text-sm`}
                  />

                  {errors["entity.legalName"] && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors["entity.legalName"]}
                    </p>
                  )}
                </div>

                {/* Entity Type */}
                <div>
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    Entity Type <span className="text-red-500">*</span>
                  </label>

                  <select
                    value={formData.entity.entityType}
                    onChange={(e) => updateEntity("entityType", e.target.value)}
                    className={`mt-1 w-full px-4 py-1 rounded-md border 
          dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200
          ${
            errors["entity.entityType"]
              ? "border-red-500 bg-red-50"
              : "border-slate-300"
          }
          focus:ring-2 focus:ring-blue-500/20 
          focus:border-blue-500 outline-none text-sm`}
                  >
                    <option value="">Select</option>
                    {ENTITY_TYPE_OPTIONS.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>

                  {errors["entity.entityType"] && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors["entity.entityType"]}
                    </p>
                  )}
                </div>

                {/* DBA */}
                <div>
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    DBA (if applicable)
                  </label>

                  <input
                    value={formData.entity.dba}
                    onChange={(e) => updateEntity("dba", e.target.value)}
                    className="mt-1 w-full px-4 py-1 rounded-md border border-slate-300 
          dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200
          focus:ring-2 focus:ring-blue-500/20 
          focus:border-blue-500 outline-none text-sm"
                  />
                </div>

                {/* Formation Date */}
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
                    <p className="text-xs text-red-500 mt-1">
                      {errors["entity.formationDate"]}
                    </p>
                  )}
                </div>

                {/* Years */}
                <div>
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    Years in Business <span className="text-red-500">*</span>
                  </label>

                  <input
                    type="number"
                    value={formData.entity.yearsInBusiness}
                    onChange={(e) =>
                      updateEntity("yearsInBusiness", e.target.value)
                    }
                    className={`mt-1 w-full px-4 py-1 rounded-md border 
          dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200
          ${
            errors["entity.yearsInBusiness"]
              ? "border-red-500 bg-red-50"
              : "border-slate-300"
          }
          focus:ring-2 focus:ring-blue-500/20 
          focus:border-blue-500 outline-none text-sm`}
                  />

                  {errors["entity.yearsInBusiness"] && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors["entity.yearsInBusiness"]}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ---------------- BORROWER INFORMATION ---------------- */}
          {/* step-3   */}
          {currentStep === 3 && (
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
                      onChange={(e) => updateBorrower("name", e.target.value)}
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
                      onChange={(e) => updateBorrower("email", e.target.value)}
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
                      DOB (mm/dd/yyyy) <span className="text-red-500">*</span>
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
                      Present Address <span className="text-red-500">*</span>
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
                      onChange={(e) => updateBorrower("city", e.target.value)}
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
                      onChange={(e) => updateBorrower("state", e.target.value)}
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
                            onClick={() => handleRemoveCoBorrower(borrower.id)}
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
                              updateCoBorrower(index, "name", e.target.value)
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
                            Entity Name <span className="text-red-500">*</span>
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
                              const formatted = formatUSPhone(e.target.value);
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
                              updateCoBorrower(index, "email", e.target.value)
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
                            Credit Score <span className="text-red-500">*</span>
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
                              updateCoBorrower(index, "address", e.target.value)
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
                              updateCoBorrower(index, "city", e.target.value)
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
                              updateCoBorrower(index, "state", e.target.value)
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
                            value={formData.coBorrowers[index]?.mailingAddress}
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

                          {errors[`coBorrowers.${index}.mailingAddress`] && (
                            <p className="text-xs text-red-500 mt-1">
                              {errors[`coBorrowers.${index}.mailingAddress`]}
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
                            { label: "Purchase Price", key: "purchasePrice" },
                            { label: "Interest Rate (%)", key: "interestRate" },
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
                                  errors[`coBorrowers.${index}.${field.key}`]
                                    ? "border-red-500 bg-red-50"
                                    : "border-slate-300"
                                }`}
                              />

                              {errors[`coBorrowers.${index}.${field.key}`] && (
                                <p className="text-xs text-red-500 mt-1">
                                  {errors[`coBorrowers.${index}.${field.key}`]}
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

          {/* ================= STEP 4 ================= */}
          {currentStep === 4 && (
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
                          checked={formData.loanTermIncome.floodZone === "yes"}
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
          )}

          {activeSectionIndex !== null &&
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
            <button
              onClick={() => {
                const isValid = validateCurrentStep();
                console.log("Errors:", errors);
                if (!isValid) return;

                if (currentStep === allSteps.length - 1) {
                  handleSubmitApplication();
                  return;
                }

                if (
                  currentStep === 2 &&
                  selectedProduct &&
                  dynamicSections.length === 0
                ) {
                  fetchSectionsByProduct(selectedProduct);
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
                : "Save & Next"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default LoanApplication;
