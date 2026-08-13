import { ABL_PROPERTY_TYPE_OPTIONS_BY_PRODUCT, isEquipmentFinanceProduct, showAblBase44PurchasePrice, showEquipmentFinanceMarketValue } from "../../lib/ablBase44";
import { ResidentialBorrowerFields } from "../../lib/residentialBorrower";
import { ResidentialFinancials } from "../../lib/residentialFinancials";
import { isSba7aAcquisitionProduct, isSbaRealEstateCollateralProduct, SBA_504_REAL_ESTATE_PROPERTY_TYPES, SBA_7A_ACQUISITION_BUSINESS_TYPES, SBA_7A_EQUIPMENT_BUSINESS_TYPES, SBA_7A_REAL_ESTATE_PROPERTY_TYPES, SBA_7A_WORKING_CAPITAL_BUSINESS_TYPES, USDA_BI_PROPERTY_TYPES } from "../../lib/sba7aAcquisition";

export const LOAN_PURPOSE_MAP: Record<string, string[]> = {
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

export const PROPERTY_TYPE_MAP: Record<string, string[]> = {
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
    workingWithMortgageBroker: "" | "yes" | "no";
    referringBroker: {
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

export const US_STATES = [
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

export const ALL_LOAN_PURPOSES = [
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

export const PRODUCT_LABELS: Record<string, string> = {
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

export const OPTIONAL_LOAN_REQUEST_KEYS = new Set([
    "sellerFinancing",
    "sellerNoteAmount",
    "estimatedClosingDate",
    "brokerPoints",
    "amortization",
    "rateType",
    "interestRate",
    "recourse",
    "numberOfUnits",
    "subPropertyType",
    "rehabCost",
    "constructionCost",
    "useOfFunds",
    "exitStrategy",
    "currentLoanBalance",
    "subPurpose",
    "additionalCollateral",
    "privateSale",
    "vendorName",
    "vendorPhone",
    "collateralType",
    "downPayment",
]);

export const PURCHASE_DATE_WITH_AMORTIZATION_LOAN_TYPES = new Set([
    "DSCR_LOAN_1_TO_4_UNITS",
    "RENTAL_PORTFOLIO",
    "CRE_PERMANENT_LOAN",
    "AGENCY_LOAN_MULTIFAMILY",
    "CMBS",
    "SBA_7A_REAL_ESTATE",
    "SBA_504_REAL_ESTATE_AND_EQUIPMENT",
    "USDA_BI",
]);
export const PURCHASE_DATE_WITH_AMORTIZATION_PURPOSES = new Set([
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
export const ORIGINAL_PURCHASE_DATE_WITH_AMORTIZATION_PURPOSES = new Set([
    "Refinance (Rate & Term)",
    "Cash Out Refinance",
    "Refinance",
    "Refinance & Rehab",
    "Refinance (504 Debt)",
    "Debt Refinancing",
]);

export const CONSTRUCTION_LOAN_TYPES = new Set([
    "CONSTRUCTION_LOAN",
    "CONSTRUCTION_LOAN_1_TO_4_UNITS",
]);

export const STATIC_FIELD_KEYS = [
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

export const ENTITY_TYPE_OPTIONS = [
    { value: "C-Corp", label: "C-Corp" },
    { value: "S-Corp", label: "S-Corp" },
    { value: "LLC", label: "LLC" },
    { value: "Partnership", label: "Partnership" },
    { value: "Sole Proprietorship", label: "Sole Proprietorship" },
] as const;

export const RESIDENTIAL_1_4_PROPERTY_TYPES = [
    "Single Family (1-Unit)",
    "Duplex (2-Unit)",
    "Triplex (3-Unit)",
    "Fourplex (4-Unit)",
] as const;

export const RENTAL_PORTFOLIO_LOAN_TYPES = new Set(["RENTAL_PORTFOLIO"]);
export const RENTAL_UNDERWRITING_LOAN_TYPES = new Set([
    "DSCR_LOAN_1_TO_4_UNITS",
    "RENTAL_PORTFOLIO",
]);

export const RESIDENTIAL_PURCHASE_PRICE_PURPOSES = new Set([
    "Purchase/Acquisition",
    "Purchase & Rehab",
    "Purchase",
    "Portfolio Blanket",
]);

export const RESIDENTIAL_MARKET_VALUE_PURPOSES = new Set([
    "Refinance (Rate & Term)",
    "Cash Out Refinance",
    "Refinance & Rehab",
    "Refinance",
]);

export const isResidential14Category = (category: LoanCategory) =>
    category === "RESIDENTIAL_1_4";

export const LOAN_SUB_PURPOSE_MAP: Record<string, string[]> = {
    CONSTRUCTION_LOAN_1_TO_4_UNITS: [
        "Ground-up Construction",
        "Major Renovation (>50% of value)",
        "Tenant Improvements",
        "Infrastructure Development",
    ],
    MEZZANINE_FINANCE: [
        "Gap Finance",
        "Leverage Enhancement",
        "JV Equity",
        "Acquisition Bridge",
        "Construction Project",
    ],
};

export const BRIDGE_LOAN_TYPES = new Set(["BRIDGE_LOAN", "BRIDGE_LOAN_1_TO_4_UNITS"]);
export const BRIDGE_PURCHASE_PURPOSE = "Purchase/Acquisition";
export const BRIDGE_ORIGINAL_PURCHASE_DATE_PURPOSES = new Set([
    "Refinance (Rate & Term)",
    "Cash Out Refinance",
]);
export const BRIDGE_CONSTRUCTION_COMPLETION_PURPOSE = "Construction Completion";

export const FIX_AND_FLIP_LOAN_TYPES = new Set(["FIX_AND_FLIP_LOAN_1_TO_4_UNITS"]);
export const FIX_AND_FLIP_PURCHASE_REHAB_PURPOSE = "Purchase & Rehab";
export const FIX_AND_FLIP_REFINANCE_REHAB_PURPOSE = "Refinance & Rehab";

export const MEZZANINE_LOAN_TYPES = new Set(["MEZZANINE_FINANCE"]);
export const MEZZANINE_ACQUISITION_BRIDGE_PURPOSE = "Acquisition Bridge";

export const isBridgePurchaseAcquisition = (product: string, purpose: string) =>
    BRIDGE_LOAN_TYPES.has(product) && purpose === BRIDGE_PURCHASE_PURPOSE;

export const isBridgeOriginalPurchaseDate = (product: string, purpose: string) =>
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

export const SBA_7A_ACQUISITION_PURCHASE_DATE_PURPOSES = new Set([
    "Purchase/Acquisition",
    "Franchise Purchase",
]);

export const isSba7aAcquisitionPurchaseDate = (product: string, purpose: string) =>
    product === "SBA_7A_BUSINESS_ACQUISITION" &&
    SBA_7A_ACQUISITION_PURCHASE_DATE_PURPOSES.has(purpose);

export const isSba7aAcquisitionNonPurchase = (product: string, purpose: string) =>
    product === "SBA_7A_BUSINESS_ACQUISITION" &&
    Boolean(purpose?.trim()) &&
    !SBA_7A_ACQUISITION_PURCHASE_DATE_PURPOSES.has(purpose);

export const SBA_7A_WORKING_CAPITAL_PURCHASE_DATE_PURPOSES = new Set([
    "Inventory Purchase",
]);

export const SBA_7A_WORKING_CAPITAL_ORIGINAL_PURCHASE_DATE_PURPOSES = new Set([
    "Debt Consolidation",
]);

export const isSba7aWorkingCapitalOriginalPurchaseDate = (
    product: string,
    purpose: string,
) =>
    product === "SBA_7A_WORKING_CAPITAL" &&
    SBA_7A_WORKING_CAPITAL_ORIGINAL_PURCHASE_DATE_PURPOSES.has(purpose);

export const isSba7aWorkingCapitalLoanRequestDate = (
    product: string,
    purpose: string,
) =>
    product === "SBA_7A_WORKING_CAPITAL" &&
    (SBA_7A_WORKING_CAPITAL_PURCHASE_DATE_PURPOSES.has(purpose) ||
        SBA_7A_WORKING_CAPITAL_ORIGINAL_PURCHASE_DATE_PURPOSES.has(purpose));

export const isSba7aWorkingCapitalNonPurchase = (product: string, purpose: string) =>
    product === "SBA_7A_WORKING_CAPITAL" &&
    Boolean(purpose?.trim()) &&
    !isSba7aWorkingCapitalLoanRequestDate(product, purpose);

export const SBA_7A_EQUIPMENT_ORIGINAL_PURCHASE_DATE_PURPOSES = new Set([
    "Refinance Existing Equipment",
]);

export const isSba7aEquipmentOriginalPurchaseDate = (
    product: string,
    purpose: string,
) =>
    product === "SBA_7A_EQUIPMENT_PURCHASE" &&
    SBA_7A_EQUIPMENT_ORIGINAL_PURCHASE_DATE_PURPOSES.has(purpose);

export const isSba7aEquipmentLoanRequestDate = (product: string, purpose: string) =>
    product === "SBA_7A_EQUIPMENT_PURCHASE" &&
    SBA_7A_EQUIPMENT_ORIGINAL_PURCHASE_DATE_PURPOSES.has(purpose);

export const isSba7aEquipmentNonPurchase = (product: string, purpose: string) =>
    product === "SBA_7A_EQUIPMENT_PURCHASE" &&
    Boolean(purpose?.trim()) &&
    !isSba7aEquipmentLoanRequestDate(product, purpose);


export const EQUIPMENT_FINANCE_PURCHASE_DATE_PURPOSES = new Set([
    "New Equipment Purchase",
    "Used Equipment Purchase",
]);

export const EQUIPMENT_FINANCE_ORIGINAL_PURCHASE_DATE_PURPOSES = new Set([
    "Refinance/Consolidation",
]);

export const isEquipmentFinanceOriginalPurchaseDate = (
    product: string,
    purpose: string,
) =>
    product === "EQUIPMENT_FINANCE" &&
    EQUIPMENT_FINANCE_ORIGINAL_PURCHASE_DATE_PURPOSES.has(purpose);

export const isEquipmentFinanceLoanRequestDate = (product: string, purpose: string) =>
    product === "EQUIPMENT_FINANCE" &&
    (EQUIPMENT_FINANCE_PURCHASE_DATE_PURPOSES.has(purpose) ||
        EQUIPMENT_FINANCE_ORIGINAL_PURCHASE_DATE_PURPOSES.has(purpose));

export const isEquipmentFinanceNonPurchase = (product: string, purpose: string) =>
    product === "EQUIPMENT_FINANCE" &&
    Boolean(purpose?.trim()) &&
    !isEquipmentFinanceLoanRequestDate(product, purpose);

export const PURCHASE_ORDER_FINANCE_PURCHASE_DATE_PURPOSES = new Set<string>([]);
export const PURCHASE_ORDER_FINANCE_ORIGINAL_PURCHASE_DATE_PURPOSES = new Set<string>(
    [],
);

export const isPurchaseOrderFinanceLoanRequestDate = (
    product: string,
    purpose: string,
) =>
    product === "PURCHASE_ORDER_FINANCE" &&
    (PURCHASE_ORDER_FINANCE_PURCHASE_DATE_PURPOSES.has(purpose) ||
        PURCHASE_ORDER_FINANCE_ORIGINAL_PURCHASE_DATE_PURPOSES.has(purpose));

export const isPurchaseOrderFinanceNonPurchase = (product: string, purpose: string) =>
    product === "PURCHASE_ORDER_FINANCE" &&
    Boolean(purpose?.trim()) &&
    !isPurchaseOrderFinanceLoanRequestDate(product, purpose);

export const ACCOUNTS_RECEIVABLE_LOAN_TYPES = new Set([
    "ACCOUNTS_RECEIVABLE_FINANCE",
    "ACCOUNTS_RECEIVABLE",
]);

export const ACCOUNTS_RECEIVABLE_PURCHASE_DATE_PURPOSES = new Set<string>([]);
export const ACCOUNTS_RECEIVABLE_ORIGINAL_PURCHASE_DATE_PURPOSES = new Set<string>([]);

export const isAccountsReceivableLoanRequestDate = (
    product: string,
    purpose: string,
) =>
    ACCOUNTS_RECEIVABLE_LOAN_TYPES.has(product) &&
    (ACCOUNTS_RECEIVABLE_PURCHASE_DATE_PURPOSES.has(purpose) ||
        ACCOUNTS_RECEIVABLE_ORIGINAL_PURCHASE_DATE_PURPOSES.has(purpose));

export const isAccountsReceivableNonPurchase = (product: string, purpose: string) =>
    ACCOUNTS_RECEIVABLE_LOAN_TYPES.has(product) &&
    Boolean(purpose?.trim()) &&
    !isAccountsReceivableLoanRequestDate(product, purpose);

export const ACCOUNTS_PAYABLE_PURCHASE_DATE_PURPOSES = new Set<string>([]);
export const ACCOUNTS_PAYABLE_ORIGINAL_PURCHASE_DATE_PURPOSES = new Set<string>([]);

export const isAccountsPayableLoanRequestDate = (product: string, purpose: string) =>
    product === "ACCOUNTS_PAYABLE_FINANCE" &&
    (ACCOUNTS_PAYABLE_PURCHASE_DATE_PURPOSES.has(purpose) ||
        ACCOUNTS_PAYABLE_ORIGINAL_PURCHASE_DATE_PURPOSES.has(purpose));

export const isAccountsPayableNonPurchase = (product: string, purpose: string) =>
    product === "ACCOUNTS_PAYABLE_FINANCE" &&
    Boolean(purpose?.trim()) &&
    !isAccountsPayableLoanRequestDate(product, purpose);

export const hidesLoanRequestAmortization = (product: string, purpose: string) =>
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

export const isFixAndFlipPurchaseRehab = (product: string, purpose: string) =>
    FIX_AND_FLIP_LOAN_TYPES.has(product) &&
    purpose === FIX_AND_FLIP_PURCHASE_REHAB_PURPOSE;

export const isFixAndFlipRefinanceRehab = (product: string, purpose: string) =>
    FIX_AND_FLIP_LOAN_TYPES.has(product) &&
    purpose === FIX_AND_FLIP_REFINANCE_REHAB_PURPOSE;

export const isCrePermanentRecapitalization = (product: string, purpose: string) =>
    product === "CRE_PERMANENT_LOAN" && purpose === "Recapitalization";

export const AGENCY_MULTIFAMILY_NO_PURCHASE_DATE_PURPOSES = new Set([
    "Affordable Housing",
    "Supplement Loan",
]);

export const isAgencyMultifamilyNoPurchaseDate = (product: string, purpose: string) =>
    product === "AGENCY_LOAN_MULTIFAMILY" &&
    AGENCY_MULTIFAMILY_NO_PURCHASE_DATE_PURPOSES.has(purpose);

export const isPurchaseDateWithAmortization = (product: string, purpose: string) =>
    PURCHASE_DATE_WITH_AMORTIZATION_LOAN_TYPES.has(product) &&
    (PURCHASE_DATE_WITH_AMORTIZATION_PURPOSES.has(purpose) ||
        ORIGINAL_PURCHASE_DATE_WITH_AMORTIZATION_PURPOSES.has(purpose));

export const isOriginalPurchaseDateWithAmortization = (
    product: string,
    purpose: string,
) =>
    PURCHASE_DATE_WITH_AMORTIZATION_LOAN_TYPES.has(product) &&
    ORIGINAL_PURCHASE_DATE_WITH_AMORTIZATION_PURPOSES.has(purpose);

export const isLoanRequestOriginalPurchaseDate = (product: string, purpose: string) =>
    isBridgeOriginalPurchaseDate(product, purpose) ||
    isFixAndFlipRefinanceRehab(product, purpose) ||
    isOriginalPurchaseDateWithAmortization(product, purpose) ||
    isSba7aWorkingCapitalOriginalPurchaseDate(product, purpose) ||
    isSba7aEquipmentOriginalPurchaseDate(product, purpose) ||
    isEquipmentFinanceOriginalPurchaseDate(product, purpose);

export const isBridgeLoanRequestDateField = (product: string, purpose: string) =>
    isBridgePurchaseAcquisition(product, purpose) ||
    isBridgeOriginalPurchaseDate(product, purpose);

export const isLoanRequestPurchaseDateReplacesAmortization = (
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

export const isLoanRequestPurchaseDateField = (product: string, purpose: string) =>
    isLoanRequestPurchaseDateReplacesAmortization(product, purpose) ||
    isPurchaseDateWithAmortization(product, purpose);

export const shouldHidePropertyPurchaseDate = (product: string, purpose: string) =>
    isLoanRequestPurchaseDateField(product, purpose) ||
    hidesLoanRequestAmortization(product, purpose) ||
    isCrePermanentRecapitalization(product, purpose) ||
    isAgencyMultifamilyNoPurchaseDate(product, purpose);

export const getLoanRequestPurchaseDateLabel = (product: string, purpose: string) =>
    isLoanRequestOriginalPurchaseDate(product, purpose)
        ? "Original Purchase Date"
        : "Purchase Date";


export const CRE_RESIDENTIAL_LIKE_LOAN_TYPES = new Set([
    "BRIDGE_LOAN",
    "FIX_AND_FLIP_LOAN_1_TO_4_UNITS",
    "DSCR_LOAN_1_TO_4_UNITS",
    "export CONSTRUCTION_LOAN",
    "RENTAL_PORTFOLIO",
]);

export const isCreResidentialLikeCategoryProduct = (
    category: LoanCategory,
    product: string,
) =>
    category === "CRE_MULTIFAMILY" &&
    CRE_RESIDENTIAL_LIKE_LOAN_TYPES.has(product);

export const isBridgeProduct = (product: string) => BRIDGE_LOAN_TYPES.has(product);

export const CRE_PERMANENT_LOAN_TYPE = "CRE_PERMANENT_LOAN";
export const AGENCY_MULTIFAMILY_LOAN_TYPE = "AGENCY_LOAN_MULTIFAMILY";
export const CMBS_LOAN_TYPE = "CMBS";
export const MEZZANINE_FINANCE_LOAN_TYPE = "MEZZANINE_FINANCE";

export const CRE_BASE44_LOAN_TYPES = new Set([
    CRE_PERMANENT_LOAN_TYPE,
    AGENCY_MULTIFAMILY_LOAN_TYPE,
    CMBS_LOAN_TYPE,
    MEZZANINE_FINANCE_LOAN_TYPE,
]);

export const CRE_BASE44_EBITDA_LOAN_TYPES = new Set([
    CRE_PERMANENT_LOAN_TYPE,
    AGENCY_MULTIFAMILY_LOAN_TYPE,
    CMBS_LOAN_TYPE,
]);

export const isCrePermanentProduct = (product: string) =>
    product === CRE_PERMANENT_LOAN_TYPE;

export const isAgencyMultifamilyProduct = (product: string) =>
    product === AGENCY_MULTIFAMILY_LOAN_TYPE;

export const isCreBase44Product = (product: string) =>
    CRE_BASE44_LOAN_TYPES.has(product);

export const showCreBase44EntityEbitda = (product: string) =>
    CRE_BASE44_EBITDA_LOAN_TYPES.has(product);

export const isConstructionLoanProduct = (product: string) =>
    product === "CONSTRUCTION_LOAN_1_TO_4_UNITS" ||
    product === "CONSTRUCTION_LOAN";

export const showResidentialPropertyPurchasePrice = (
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

export const showResidentialPropertyConstructionCost = (product: string) =>
    isConstructionLoanProduct(product);

export const showResidentialPropertyMarketValue = (product: string, purpose: string) =>
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

export const showResidentialPropertyArv = (product: string) =>
    FIX_AND_FLIP_LOAN_TYPES.has(product) || isConstructionLoanProduct(product);

export const showResidentialPropertyRehabCost = (product: string) =>
    FIX_AND_FLIP_LOAN_TYPES.has(product);

export const isFixAndFlipProduct = (product: string) =>
    FIX_AND_FLIP_LOAN_TYPES.has(product);

// Valuation, Costs & Equity
export const showValuationCostEquity = (product: string, purpose: string) => {
    if (
        (purpose === "Refinance & Rehab" &&
            product === "FIX_AND_FLIP_LOAN_1_TO_4_UNITS") ||
        (purpose === "Refinance" && product === "CONSTRUCTION_LOAN_1_TO_4_UNITS")
    ) {
        return true;
    }
    return false;
};

export const showEquityDownPaymentBlock = (
    product: string,
    purpose: string,
    selectedCategory: LoanCategory,
) => {
    if (
        (purpose === "Refinance & Rehab" &&
            product === "FIX_AND_FLIP_LOAN_1_TO_4_UNITS") ||
        (purpose === "Refinance" && product === "CONSTRUCTION_LOAN_1_TO_4_UNITS")
    ) {
        return false;
    }

    if (
        purpose === "Purchase/Acquisition" ||
        (product === "DSCR_LOAN_1_TO_4_UNITS" && purpose === "Purchase") ||
        purpose === "Purchase" ||
        purpose === "Franchise Purchase" ||
        purpose === "Inventory Purchase" ||
        purpose === "Purchase (Owner-Occupied)" ||
        purpose === "Purchase & Rehab" ||
        purpose === "Real Estate Acquisition" ||
        purpose === "Business Acquisition" ||
        purpose === "Real Estate Purchase" ||
        purpose === "Equipment Purchase" ||
        purpose === "New Equipment Purchase" ||
        purpose === "Used Equipment Purchase"
    ) {
        return true;
    }

    if (!isFixAndFlipProduct(product)) return false;
    if (selectedCategory !== "RESIDENTIAL_1_4") return false;
    if (!purpose) return true;
    return (
        isFixAndFlipPurchaseRehab(product, purpose) ||
        isFixAndFlipRefinanceRehab(product, purpose)
    );
};

export const isConstructionPurchase = (purpose: string, selectedProduct: string) => {
    if (
        selectedProduct === "CONSTRUCTION_LOAN_1_TO_4_UNITS" &&
        purpose === "Purchase"
    ) {
        return true;
    }
    return false;
};

export const showValuationEquityBlock = (product: string, purpose: string) => {
    if (!purpose) return false;
    if (
        purpose === "Construction Completion" ||
        purpose === "Portfolio Blanket" ||
        purpose === "Recapitalization" ||
        purpose === "Affordable Housing" ||
        purpose === "Supplement Loan" ||
        purpose === "Refinance & Rehab" ||
        purpose === "Debt Consolidation" ||
        purpose === "Refinance Existing Equipment" ||
        purpose === "Refinance (504 Debt)" ||
        (purpose === "Refinance" && product === "CONSTRUCTION_LOAN_1_TO_4_UNITS")
    ) {
        return false;
    }

    return (
        RESIDENTIAL_MARKET_VALUE_PURPOSES.has(purpose) ||
        isBridgeOriginalPurchaseDate(product, purpose) ||
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
            showEquipmentFinanceMarketValue(purpose))
    );
};

export const HIDE_EXIT_STRATEGY_PRODUCTS = new Set([
    "DSCR_LOAN_1_TO_4_UNITS",
    "RENTAL_PORTFOLIO",
    "CRE_PERMANENT_LOAN",
    "AGENCY_LOAN_MULTIFAMILY",
    "CMBS",
]);

export const HIDE_EXIT_STRATEGY_CATEGORIES = new Set(["SBA_USDA", "ABL"]);

export const showExitStrategy = (product: string, category: string) =>
    !HIDE_EXIT_STRATEGY_PRODUCTS.has(product) &&
    !HIDE_EXIT_STRATEGY_CATEGORIES.has(category);

export const SBA_COLLATERAL_TYPE_OPTIONS_BY_PRODUCT: Record<
    string,
    readonly string[]
> = {
    SBA_7A_BUSINESS_ACQUISITION: SBA_7A_ACQUISITION_BUSINESS_TYPES,
    SBA_7A_WORKING_CAPITAL: SBA_7A_WORKING_CAPITAL_BUSINESS_TYPES,
    SBA_7A_EQUIPMENT_PURCHASE: SBA_7A_EQUIPMENT_BUSINESS_TYPES,
    SBA_7A_REAL_ESTATE: SBA_7A_REAL_ESTATE_PROPERTY_TYPES,
    SBA_504_REAL_ESTATE_AND_EQUIPMENT: SBA_504_REAL_ESTATE_PROPERTY_TYPES,
    USDA_BI: USDA_BI_PROPERTY_TYPES,
};

export const SBA_COLLATERAL_TYPE_LABEL_BY_PRODUCT: Record<
    string,
    "Business / Industry Type" | "Property Type"
> = {
    SBA_7A_BUSINESS_ACQUISITION: "Business / Industry Type",
    SBA_7A_WORKING_CAPITAL: "Business / Industry Type",
    SBA_7A_EQUIPMENT_PURCHASE: "Business / Industry Type",
    SBA_7A_REAL_ESTATE: "Property Type",
    SBA_504_REAL_ESTATE_AND_EQUIPMENT: "Property Type",
    USDA_BI: "Property Type",
};

export const getSbaCollateralTypeOptions = (product: string) =>
    SBA_COLLATERAL_TYPE_OPTIONS_BY_PRODUCT[product] || null;

export const getSbaCollateralTypeLabel = (
    product: string,
): "Business / Industry Type" | "Property Type" | null =>
    SBA_COLLATERAL_TYPE_LABEL_BY_PRODUCT[product] || null;

export const isSbaUsdaCollateralProduct = (product: string) =>
    Boolean(getSbaCollateralTypeOptions(product));

export const getAblCollateralTypeOptions = (product: string) =>
    ABL_PROPERTY_TYPE_OPTIONS_BY_PRODUCT[product] || null;

export const isAblCollateralProduct = (product: string) =>
    Boolean(getAblCollateralTypeOptions(product));

export const LOAN_TOP_PURPOSE_MAP: Record<string, string[]> = {
    CONSTRUCTION_LOAN_1_TO_4_UNITS: ["Purchase", "Refinance"],
    MEZZANINE_FINANCE: ["Purchase", "Refinance"],
};



export const isRentalPortfolioProduct = (product: string) =>
    RENTAL_PORTFOLIO_LOAN_TYPES.has(product);

export const isRentalUnderwritingProduct = (product: string) =>
    RENTAL_UNDERWRITING_LOAN_TYPES.has(product);

export const isConstruction14Product = (product: string) =>
    isConstructionLoanProduct(product);

export type LoanApplicationMode = "create" | "update";

export type LoanApplicationProps = {
    mode?: LoanApplicationMode;
    embedded?: boolean;
    publicEmbed?: boolean;
    editApplicationId?: string;
    initialFormData?: FormDataType;
    initialSelectedProduct?: string;
    initialSelectedCategory?: LoanCategory;
    initialDynamicFormData?: Record<string, any>;
    onUpdateSuccess?: (submissionId?: string) => void;
    onPublicSubmitSuccess?: (submissionId?: string) => void;
    onPublicSubmitError?: (message: string) => void;
    brokerOrgId?: string | null;
    /** Opaque public link token from ?ref= */
    publicLinkRef?: string | null;
    /** Server-resolved portal provenance */
    publicSourcePortal?:
    | "BROKER"
    | "LOAN_OFFICER"
    | "CO_BROKER"
    | "LEGACY"
    | null;
    showCoBrokerBorrowerInformationTab?: boolean;
};

export const CO_BROKER_BORROWER_INFO_STEP = "Broker / Co-Broker Information";