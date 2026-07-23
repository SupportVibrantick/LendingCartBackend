const { z, property } = require("zod");

const yesNo = z.enum(["yes", "no"]);

// Many numeric fields arrive as either a number or a numeric string
// (e.g. "111", "7123456789"). Coerce so both are accepted.
const numeric = z.coerce.number();
const optionalNumeric = numeric.nullable().default(0);

const financialColumnKeys = [
  "grossRentalIncome",
  "vacancyCreditLoss",
  "operatingExpenses",
  // "mortgageDebtService",
  "effectiveGrossIncomeOverride",
  "effectiveGrossIncomeOverride_computed",
  "noiOverride",
  "noiOverride_computed",
  "cashFlowAfterDebtOverride",
  "cashFlowAfterDebtOverride_computed",
];
// ENUMS 
const US_STATS= z.enum([
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
  ]);

const financialColumnFields = financialColumnKeys.reduce((acc, key) => {
  for (let col = 0; col < 4; col++) {
    acc[`financial_${key}_col${col}`] = numeric.default(0);
  }
  return acc;
}, {});

// Main

const loanApplicationFieldsSchema = z.object({

    // Loan Request (TAB 1)
  loanCategory: z.enum([
    "RESIDENTIAL_1_4",
    "CRE_MULTIFAMILY",
    "SBA_USDA",
    "ABL",
  ]),
  loanProductCode: z.string().min(1).max(30),
  purpose: z.string().min(1).max(30),
  amountRequested: numeric.positive(),
  interestRate: z.coerce.number().min(0),
  propertyType: z.string().min(1),
  recourse: z.enum(["FULL_RECOURSE", "NON_RECOURSE"]),
  rateType: z.enum(["FIXED", "VARIABLE", "HYBRID"]),
  loanTerm: z.coerce.number().int().positive(),
  brokerPoints: z.coerce.number().min(0),
  sellerFinancing: yesNo,
  sellerNoteAmount: optionalNumeric,

   // Entity Info (TAB 2)
  entityLegalName: z.string().min(1),
  entityType: z.enum([
    "Sole Proprietorship",
    "Partnership",
    "LLC",
    "C-Corp",
    "S-Corp",
    "Trust",
    "Other",
  ]),
  formationDate: z.iso.date(),
  yearsInBusiness: z.coerce.number().min(0),
  entityDBA: z.string().optional().default(""),

  // Property Info (TAB 3)
  propertyType:z.string().min(1).max(30),
  propertyAddress: z.string().min(1),
  propertyCity: z.string().min(1),
  propertyState: US_STATS,
  propertyZip: z.string().min(1),
  propertyCountry: z.string().min(1), 
  propertyUnits: optionalNumeric,
  rehabBudget: z.number(),
  afterRepairValue: z.number(),
  propertyPurchaseDate:z.iso.date(),


  // Borrower identity  -> TAB 4
  borrowerFirstName: z.string().min(3),
  borrowerLastName: z.string().min(1),
  entityOwnershipPercent: z.coerce.number().min(0).max(100),
  phone: z.string().min(1),
  email: z.string().email(),
  ssn: z
    .string()
    .regex(/^\d{3}-\d{2}-\d{4}$/, "SSN must be in format XXX-XX-XXXX"),
  legalStatus: z.enum([
    "US Citizen",
    "Work Visa",
    "Green Card Holder",
    "Business Visa",
    "Foreign National",
  ]),
  creditScore: z.coerce.number().int().min(300).max(850),
  similarProjectsCompleted: z.coerce.number().int().min(0).default(0),
  yearsOfExperience: z.coerce.number().min(0),
  totalCashReserves: optionalNumeric,

  // Assets  TAB 4
  asset_cashOnHand: optionalNumeric,
  asset_savingsAccounts: optionalNumeric,
  asset_iraRetirement: optionalNumeric,
  asset_accountsReceivable: optionalNumeric,
  asset_lifeInsuranceCashValue: optionalNumeric,
  asset_stocksAndBonds: optionalNumeric,
  asset_realEstate: optionalNumeric,
  asset_automobileValue: optionalNumeric,
  asset_otherPersonalProperty: optionalNumeric,
  asset_otherAssets: optionalNumeric,

  // Liabilities TAB 4
  liability_accountsPayable: optionalNumeric,
  liability_notesPayable: optionalNumeric,
  liability_autoMonthlyPayments: optionalNumeric,
  liability_otherInstallmentPayments: optionalNumeric,
  liability_loanOnLifeInsurance: optionalNumeric,
  liability_mortgagesOnRealEstate: optionalNumeric,
  liability_unpaidTaxes: optionalNumeric,
  liability_otherLiabilities: optionalNumeric,

  totalAssets: optionalNumeric,
  totalLiabilities: optionalNumeric,
  netWorth: numeric,


// Financials (TAB 5)

  // Rental / DSCR inputs
  rentalProperty: yesNo,
  hasRentalIncome: yesNo,
  monthlyRent: optionalNumeric,

  financialReferenceYear: z.coerce.number().int(),
  financialYearColumnCount: z.coerce.number().int().min(1).max(4),
  financialYear_col0: z.coerce.number().int(),
  financialYear_col1: z.coerce.number().int(),
  financialYear_col2: z.coerce.number().int(),
  financialYear_col3: z.coerce.number().int(),


  interimMonthsReported: z.coerce.number().int().min(0).default(0),
  dscrCalculationMethod: z.enum(["noi", "cashFlow", "other"]).or(z.string()),
  ...financialColumnFields,

  // Pro forma NOI
  proFormaNoi_year_1: optionalNumeric,
  proFormaNoi_year_2: optionalNumeric,
  proFormaNoi_year_3: optionalNumeric,
  proFormaNoiAverage: optionalNumeric,

  // Carrying costs
  annualPropertyTaxes: optionalNumeric,
  annualInsurance: optionalNumeric,
  hoaDues: optionalNumeric,
  inFloodZone: yesNo,

  // Duplicate/legacy NOI & tax fields present in payload
  noiActual: optionalNumeric,
  grossRevenueActual: optionalNumeric,
  annualTaxes: optionalNumeric,
  insurancePremium: optionalNumeric,
  floodZone: yesNo,
  noiProforma: optionalNumeric,

  // Ratios
  ltvPercentage: z.coerce.number().min(0),
  ltcPercentage: z.coerce.number().min(0),
  arvPercentage: z.coerce.number().min(0),
  dscr: z.coerce.number().nullable(),

  // Declarations (borrower attestations)
  declaration_outstandingJudgments: yesNo,
  declaration_declaredBankrupt: yesNo,
  declaration_propertyForeclosed: yesNo,
  declaration_partyToLawsuit: yesNo,
  declaration_obligatedOnForeclosureLoan: yesNo,
  declaration_delinquentFederalDebt: yesNo,
  declaration_convictedFelony: yesNo,
  declaration_usCitizen: yesNo,
  declaration_permanentResidentAlien: yesNo,
  declaration_intendToOccupy: yesNo,

  sreoTotalMarketValue: optionalNumeric,
  existingDebt: optionalNumeric,
  constructionBudget: optionalNumeric,
  currentMarketValue: optionalNumeric,
  purchasePrice: optionalNumeric,
  businessIndustry: z.string().min(1),
  estimatedClosingDate: z.string().date(),
  ebitda: optionalNumeric,
  goodwillAmount: optionalNumeric,
  inventoryIncluded: yesNo,
  equipmentIncluded: yesNo,
  inventoryValue: optionalNumeric,
  equipmentValue: optionalNumeric,


  // Consent & meta
  creditAuthorizationConsent: yesNo,
  applicationDocumentCount: z.coerce.number().int().min(0).default(0),
});

// ---------- Raw payload schema (fields: [{ fieldKey, value }]) ----------

const rawFieldEntrySchema = z.object({
  fieldKey: z.string(),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});

const loanApplicationPayloadSchema = z.object({
  fields: z.array(rawFieldEntrySchema),
});

function parseLoanApplicationPayload(payload) {
  const raw = loanApplicationPayloadSchema.parse(payload);
  const flat = Object.fromEntries(raw.fields.map((f) => [f.fieldKey, f.value]));
  return loanApplicationFieldsSchema.parse(flat);
}



module.exports = {
  loanApplicationFieldsSchema,
  loanApplicationPayloadSchema,
  parseLoanApplicationPayload,
};

