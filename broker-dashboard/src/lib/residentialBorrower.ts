export type YesNo = "" | "yes" | "no";

export interface BorrowerAssets {
  cashOnHand: string;
  savingsAccounts: string;
  iraRetirement: string;
  accountsReceivable: string;
  lifeInsuranceCashValue: string;
  stocksAndBonds: string;
  realEstate: string;
  automobileValue: string;
  otherPersonalProperty: string;
  otherAssets: string;
}

export interface BorrowerLiabilities {
  accountsPayable: string;
  notesPayable: string;
  autoMonthlyPayments: string;
  otherInstallmentPayments: string;
  loanOnLifeInsurance: string;
  mortgagesOnRealEstate: string;
  unpaidTaxes: string;
  otherLiabilities: string;
}

export interface RealEstateOwnedEntry {
  id: number;
  propertyAddress: string;
  entityNameOnTitle: string;
  ownershipPercent: string;
  propertyType: string;
  acquisitionDate: string;
  purchasePrice: string;
  rehabUpgradeCost: string;
  currentMarketValue: string;
  mortgageHolderNameAddress: string;
  loanMortgageBalance: string;
  grossRentalIncome: string;
  loanTaxInsurancePaymentYr: string;
  totalAnnualExpenses: string;
  netRent: string;
  totalEquity: string;
}

export interface RecentlySoldPropertyEntry {
  id: number;
  propertyAddress: string;
  entityNameOnTitle: string;
  ownershipPercent: string;
  propertyType: string;
  purchaseDate: string;
  soldDate: string;
  purchasePrice: string;
  rehabConstructionUpgradeCost: string;
  costOfBorrowing: string;
  totalProjectCost: string;
  soldPrice: string;
  totalProfit: string;
}

export const SREO_PROPERTY_TYPE_GROUPS: { group: string; options: string[] }[] =
  [
    {
      group: "1-4 Units Residential",
      options: ["Single Family Residential", "Condo", "Town Home"],
    },
    {
      group: "CRE & Multifamily",
      options: [
        "Multifamily",
        "Garden",
        "Mid-Rise",
        "High-Rise",
        "Senior Housing",
        "Student Housing",
        "Affordable Housing",
        "Office",
        "Central Business District",
        "Medical",
        "Creative",
        "Government",
        "Suburban",
        "Retail",
        "Strip Plaza",
        "Mall",
        "Single-Tenant",
        "Restaurant",
        "Automotive",
        "Industrial",
        "Warehouse",
        "Manufacturing",
        "Flex",
        "Data Center",
        "Cold Storage",
        "Special Purpose",
        "Car Wash",
        "Gas Station",
        "Self Storage",
        "Hospital",
        "School",
        "Land",
        "Raw",
        "Entitled",
        "Developed",
        "Agriculture",
        "Mixed Use",
        "Horizontal",
        "Vertical",
        "Live & Work",
        "Hotel/Motel",
        "Assisted Living Facility",
        "RV Park",
        "Mobile Home Park",
        "Manufactured Housing",
      ],
    },
    {
      group: "SBA / USDA",
      options: [
        "Restaurant / Food Service",
        "Healthcare / Medical",
        "Professional Services",
        "Construction",
        "Transportation / Logistics",
        "Technology / Software",
        "Hospitality / Hotel",
        "Wholesale / Distribution",
        "Education",
        "Real Estate Services",
        "Personal Services",
        "Other",
      ],
    },
  ];

export interface BorrowerDeclarations {
  outstandingJudgments: YesNo;
  declaredBankrupt: YesNo;
  propertyForeclosed: YesNo;
  partyToLawsuit: YesNo;
  obligatedOnForeclosureLoan: YesNo;
  delinquentFederalDebt: YesNo;
  convictedFelony: YesNo;
  usCitizen: YesNo;
  permanentResidentAlien: YesNo;
  intendToOccupy: YesNo;
}

export interface ResidentialBorrowerFields {
  firstName: string;
  lastName: string;
  entityOwnershipPercent: string;
  legalStatus: string;
  similarProjectsCompleted: string;
  yearsOfExperience: string;
  totalCashReserves: string;
  existingDebt: string;
  assets: BorrowerAssets;
  liabilities: BorrowerLiabilities;
  realEstateOwned: RealEstateOwnedEntry[];
  recentlySoldProperties: RecentlySoldPropertyEntry[];
  declarations: BorrowerDeclarations;
}

export const LEGAL_STATUS_OPTIONS = [
  "US Citizen",
  "Green Card Holder",
  "Work Visa",
  "Business Visa",
  "Foreign National",
] as const;

export const ASSET_FIELD_DEFS: { key: keyof BorrowerAssets; label: string }[] =
  [
    { key: "cashOnHand", label: "Cash on Hand & in Banks ($)" },
    { key: "savingsAccounts", label: "Savings Accounts ($)" },
    { key: "iraRetirement", label: "IRA or Other Retirement Account ($)" },
    { key: "accountsReceivable", label: "Accounts & Notes Receivable ($)" },
    {
      key: "lifeInsuranceCashValue",
      label: "Life Insurance Cash Surrender Value ($)",
    },
    { key: "stocksAndBonds", label: "Stocks and Bonds ($)" },
    { key: "realEstate", label: "Real Estate ($)" },
    { key: "automobileValue", label: "Automobile Present Value ($)" },
    { key: "otherPersonalProperty", label: "Other Personal Property ($)" },
    { key: "otherAssets", label: "Other Assets ($)" },
  ];

export const LIABILITY_FIELD_DEFS: {
  key: keyof BorrowerLiabilities;
  label: string;
}[] = [
  { key: "accountsPayable", label: "Accounts Payable ($)" },
  {
    key: "notesPayable",
    label: "Notes Payable to Bank and Others ($)",
  },
  { key: "autoMonthlyPayments", label: "Auto Monthly Payments ($)" },
  {
    key: "otherInstallmentPayments",
    label: "Other Installment Account Payments ($)",
  },
  { key: "loanOnLifeInsurance", label: "Loan on Life Insurance ($)" },
  { key: "mortgagesOnRealEstate", label: "Mortgages on Real Estate ($)" },
  { key: "unpaidTaxes", label: "Unpaid Taxes ($)" },
  { key: "otherLiabilities", label: "Other Liabilities ($)" },
];

export const DECLARATION_QUESTIONS: {
  key: keyof BorrowerDeclarations;
  label: string;
}[] = [
  { key: "outstandingJudgments", label: "Outstanding judgments against you?" },
  {
    key: "declaredBankrupt",
    label: "Declared bankrupt in past 7 years?",
  },
  {
    key: "propertyForeclosed",
    label: "Property foreclosed or deed in lieu in last 7 years?",
  },
  { key: "partyToLawsuit", label: "Party to a lawsuit?" },
  {
    key: "obligatedOnForeclosureLoan",
    label: "Obligated on any loan resulting in foreclosure or judgment?",
  },
  {
    key: "delinquentFederalDebt",
    label: "Presently delinquent or in default on any federal debt?",
  },
  {
    key: "convictedFelony",
    label: "Convicted of a felony in past 10 years?",
  },
  { key: "usCitizen", label: "Are you a US citizen?" },
  {
    key: "permanentResidentAlien",
    label: "Are you a permanent resident alien?",
  },
  {
    key: "intendToOccupy",
    label: "Do you intend to occupy the subject property?",
  },
];

export const isDeclarationAnswered = (value: YesNo) =>
  value === "yes" || value === "no";

export const countUnansweredDeclarations = (
  declarations: BorrowerDeclarations,
) =>
  DECLARATION_QUESTIONS.filter(
    ({ key }) => !isDeclarationAnswered(declarations[key]),
  ).length;

export const collectDeclarationErrors = (
  declarations: BorrowerDeclarations,
  errorPrefix: string,
): Record<string, string> => {
  const errors: Record<string, string> = {};

  DECLARATION_QUESTIONS.forEach(({ key }) => {
    if (!isDeclarationAnswered(declarations[key])) {
      errors[`${errorPrefix}.declarations.${key}`] =
        "Please select Yes or No";
    }
  });

  return errors;
};

export const createEmptyAssets = (): BorrowerAssets => ({
  cashOnHand: "",
  savingsAccounts: "",
  iraRetirement: "",
  accountsReceivable: "",
  lifeInsuranceCashValue: "",
  stocksAndBonds: "",
  realEstate: "",
  automobileValue: "",
  otherPersonalProperty: "",
  otherAssets: "",
});

export const createEmptyLiabilities = (): BorrowerLiabilities => ({
  accountsPayable: "",
  notesPayable: "",
  autoMonthlyPayments: "",
  otherInstallmentPayments: "",
  loanOnLifeInsurance: "",
  mortgagesOnRealEstate: "",
  unpaidTaxes: "",
  otherLiabilities: "",
});

export const createEmptyDeclarations = (): BorrowerDeclarations => ({
  outstandingJudgments: "",
  declaredBankrupt: "",
  propertyForeclosed: "",
  partyToLawsuit: "",
  obligatedOnForeclosureLoan: "",
  delinquentFederalDebt: "",
  convictedFelony: "",
  usCitizen: "",
  permanentResidentAlien: "",
  intendToOccupy: "",
});

export const createEmptyRealEstateProperty = (): RealEstateOwnedEntry => ({
  id: Date.now(),
  propertyAddress: "",
  entityNameOnTitle: "",
  ownershipPercent: "",
  propertyType: "",
  acquisitionDate: "",
  purchasePrice: "",
  rehabUpgradeCost: "",
  currentMarketValue: "",
  mortgageHolderNameAddress: "",
  loanMortgageBalance: "",
  grossRentalIncome: "",
  loanTaxInsurancePaymentYr: "",
  totalAnnualExpenses: "",
  netRent: "",
  totalEquity: "",
});

export const createEmptyRecentlySoldProperty = (): RecentlySoldPropertyEntry => ({
  id: Date.now(),
  propertyAddress: "",
  entityNameOnTitle: "",
  ownershipPercent: "",
  propertyType: "",
  purchaseDate: "",
  soldDate: "",
  purchasePrice: "",
  rehabConstructionUpgradeCost: "",
  costOfBorrowing: "",
  totalProjectCost: "",
  soldPrice: "",
  totalProfit: "",
});

export const createResidentialBorrowerDefaults =
  (): ResidentialBorrowerFields => ({
    firstName: "",
    lastName: "",
    entityOwnershipPercent: "100",
    legalStatus: "",
    similarProjectsCompleted: "0",
    yearsOfExperience: "0",
    totalCashReserves: "",
    existingDebt: "",
    assets: createEmptyAssets(),
    liabilities: createEmptyLiabilities(),
    realEstateOwned: [],
    recentlySoldProperties: [],
    declarations: createEmptyDeclarations(),
  });

const parseAmount = (value: string) => {
  const cleaned = (value || "").replace(/,/g, "");
  return parseFloat(cleaned) || 0;
};

export const formatCurrencyInput = (rawValue?: string | null) => {
  const cleaned = (rawValue ?? "").replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  const normalized =
    parts.length > 1
      ? `${parts[0]}.${parts.slice(1).join("")}`
      : parts[0] || "";
  return normalized ? Number(normalized).toLocaleString("en-US") : "";
};

export const sumBorrowerAssets = (assets?: BorrowerAssets | null) =>
  ASSET_FIELD_DEFS.reduce(
    (total, { key }) => total + parseAmount(assets?.[key] ?? ""),
    0,
  );

export const sumBorrowerLiabilities = (liabilities?: BorrowerLiabilities | null) =>
  LIABILITY_FIELD_DEFS.reduce(
    (total, { key }) => total + parseAmount(liabilities?.[key] ?? ""),
    0,
  );

export const formatSignedMoney = (amount: number) => {
  const sign = amount < 0 ? "-" : "";
  return `${sign}$${Math.abs(amount).toLocaleString("en-US")}`;
};

export const formatSignedCurrencyInput = (amount: number) => {
  if (!Number.isFinite(amount)) return "";
  const sign = amount < 0 ? "-" : "";
  return `${sign}${Math.abs(amount).toLocaleString("en-US")}`;
};

export const calcSreoTotalEquity = (entry: RealEstateOwnedEntry) =>
  parseAmount(entry.currentMarketValue) - parseAmount(entry.loanMortgageBalance);

export const calcSreoNetRent = (entry: RealEstateOwnedEntry) =>
  parseAmount(entry.grossRentalIncome) -
  parseAmount(entry.loanTaxInsurancePaymentYr) -
  parseAmount(entry.totalAnnualExpenses);

export const calcSoldTotalProjectCost = (entry: RecentlySoldPropertyEntry) =>
  parseAmount(entry.purchasePrice) +
  parseAmount(entry.rehabConstructionUpgradeCost) +
  parseAmount(entry.costOfBorrowing);

export const calcSoldTotalProfit = (entry: RecentlySoldPropertyEntry) =>
  parseAmount(entry.soldPrice) - calcSoldTotalProjectCost(entry);

export const withSreoDerivedFields = (
  entry: RealEstateOwnedEntry,
): RealEstateOwnedEntry => ({
  ...entry,
  totalEquity: formatSignedCurrencyInput(calcSreoTotalEquity(entry)),
  netRent: formatSignedCurrencyInput(calcSreoNetRent(entry)),
});

export const withSoldDerivedFields = (
  entry: RecentlySoldPropertyEntry,
): RecentlySoldPropertyEntry => {
  const totalProjectCost = calcSoldTotalProjectCost(entry);
  return {
    ...entry,
    totalProjectCost: formatSignedCurrencyInput(totalProjectCost),
    totalProfit: formatSignedCurrencyInput(
      parseAmount(entry.soldPrice) - totalProjectCost,
    ),
  };
};

export const sumScheduleMarketValue = (entries?: RealEstateOwnedEntry[] | null) =>
  (entries || []).reduce(
    (total, entry) => total + parseAmount(entry.currentMarketValue),
    0,
  );

export const sumScheduleTotalEquity = (entries?: RealEstateOwnedEntry[] | null) =>
  (entries || []).reduce((total, entry) => total + calcSreoTotalEquity(entry), 0);

type SubmissionFieldLike = {
  fieldKey?: string | null;
  value?: unknown;
};

const getSubmissionFieldValue = (fields: SubmissionFieldLike[], key: string) => {
  const field = fields.find((item) => item.fieldKey === key);
  if (!field || field.value === undefined || field.value === null) {
    return undefined;
  }

  if (typeof field.value === "string") {
    try {
      return JSON.parse(field.value);
    } catch {
      return field.value;
    }
  }

  return field.value;
};

const submissionValueToString = (val: unknown): string => {
  if (val === undefined || val === null) return "";
  return String(val);
};

const submissionValueToFormNumber = (val: unknown): string => {
  if (val === undefined || val === null || val === "") return "";
  if (typeof val === "number" && Number.isFinite(val)) {
    return val.toLocaleString("en-US");
  }

  const raw = submissionValueToString(val).replace(/,/g, "");
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return submissionValueToString(val);
  return numeric.toLocaleString("en-US");
};

const submissionValueToYesNo = (val: unknown): YesNo => {
  if (val === undefined || val === null || val === "") return "";
  if (typeof val === "boolean") return val ? "yes" : "no";

  const normalized = submissionValueToString(val).trim().toLowerCase();
  if (["yes", "y", "true", "1"].includes(normalized)) return "yes";
  if (["no", "n", "false", "0"].includes(normalized)) return "no";
  return normalized as YesNo;
};

export const hydrateResidentialBorrowerFromFields = (
  fields: SubmissionFieldLike[],
  prefix = "",
): ResidentialBorrowerFields => {
  const defaults = createResidentialBorrowerDefaults();
  const p = prefix ? `${prefix}_` : "";
  const fieldKey = (key: string) => `${p}${key}`;
  const get = (key: string) => getSubmissionFieldValue(fields, fieldKey(key));

  const assets = createEmptyAssets();
  ASSET_FIELD_DEFS.forEach(({ key }) => {
    assets[key] = submissionValueToFormNumber(get(`asset_${key}`));
  });

  const liabilities = createEmptyLiabilities();
  LIABILITY_FIELD_DEFS.forEach(({ key }) => {
    liabilities[key] = submissionValueToFormNumber(get(`liability_${key}`));
  });

  const declarations = createEmptyDeclarations();
  DECLARATION_QUESTIONS.forEach(({ key }) => {
    declarations[key] = submissionValueToYesNo(get(`declaration_${key}`));
  });

  const sreoIndexes = new Set<number>();
  const escapedPrefix = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sreoPattern = new RegExp(`^${escapedPrefix}sreo_(\\d+)_`);

  fields.forEach((field) => {
    const match = (field.fieldKey || "").match(sreoPattern);
    if (match) sreoIndexes.add(Number(match[1]));
  });

  const realEstateOwned = Array.from(sreoIndexes)
    .sort((a, b) => a - b)
    .map((index) => {
      const sreoPrefix = fieldKey(`sreo_${index}_`);
      const sreoGet = (suffix: string) =>
        getSubmissionFieldValue(fields, `${sreoPrefix}${suffix}`);

      return withSreoDerivedFields({
        id: index,
        propertyAddress: submissionValueToString(sreoGet("propertyAddress")),
        entityNameOnTitle: submissionValueToString(sreoGet("entityNameOnTitle")),
        ownershipPercent: submissionValueToString(sreoGet("ownershipPercent")),
        propertyType: submissionValueToString(sreoGet("propertyType")),
        acquisitionDate: submissionValueToString(
          sreoGet("purchaseDate") ?? sreoGet("acquisitionDate"),
        ),
        purchasePrice: submissionValueToFormNumber(sreoGet("purchasePrice")),
        rehabUpgradeCost: submissionValueToFormNumber(sreoGet("rehabUpgradeCost")),
        currentMarketValue: submissionValueToFormNumber(
          sreoGet("currentMarketValue"),
        ),
        mortgageHolderNameAddress: submissionValueToString(
          sreoGet("mortgageHolderNameAddress"),
        ),
        loanMortgageBalance: submissionValueToFormNumber(
          sreoGet("loanMortgageBalance"),
        ),
        grossRentalIncome: submissionValueToFormNumber(
          sreoGet("grossRentalIncome"),
        ),
        loanTaxInsurancePaymentYr: submissionValueToFormNumber(
          sreoGet("loanTaxInsurancePaymentYr"),
        ),
        totalAnnualExpenses: submissionValueToFormNumber(
          sreoGet("totalAnnualExpenses"),
        ),
        netRent: submissionValueToFormNumber(
          sreoGet("netRent") ?? sreoGet("noiPerYear"),
        ),
        totalEquity: submissionValueToFormNumber(sreoGet("totalEquity")),
      });
    });

  const soldIndexes = new Set<number>();
  const soldPattern = new RegExp(`^${escapedPrefix}sold_(\\d+)_`);
  fields.forEach((field) => {
    const match = (field.fieldKey || "").match(soldPattern);
    if (match) soldIndexes.add(Number(match[1]));
  });

  const recentlySoldProperties = Array.from(soldIndexes)
    .sort((a, b) => a - b)
    .map((index) => {
      const soldPrefix = fieldKey(`sold_${index}_`);
      const soldGet = (suffix: string) =>
        getSubmissionFieldValue(fields, `${soldPrefix}${suffix}`);

      return withSoldDerivedFields({
        id: index,
        propertyAddress: submissionValueToString(soldGet("propertyAddress")),
        entityNameOnTitle: submissionValueToString(
          soldGet("entityNameOnTitle"),
        ),
        ownershipPercent: submissionValueToString(soldGet("ownershipPercent")),
        propertyType: submissionValueToString(soldGet("propertyType")),
        purchaseDate: submissionValueToString(soldGet("purchaseDate")),
        soldDate: submissionValueToString(soldGet("soldDate")),
        purchasePrice: submissionValueToFormNumber(soldGet("purchasePrice")),
        rehabConstructionUpgradeCost: submissionValueToFormNumber(
          soldGet("rehabConstructionUpgradeCost"),
        ),
        costOfBorrowing: submissionValueToFormNumber(
          soldGet("costOfBorrowing"),
        ),
        totalProjectCost: submissionValueToFormNumber(
          soldGet("totalProjectCost"),
        ),
        soldPrice: submissionValueToFormNumber(soldGet("soldPrice")),
        totalProfit: submissionValueToFormNumber(soldGet("totalProfit")),
      });
    });

  return {
    ...defaults,
    firstName:
      submissionValueToString(get("borrowerFirstName")) || defaults.firstName,
    lastName:
      submissionValueToString(get("borrowerLastName")) || defaults.lastName,
    entityOwnershipPercent:
      submissionValueToString(get("entityOwnershipPercent")) ||
      defaults.entityOwnershipPercent,
    legalStatus: submissionValueToString(get("legalStatus")) || defaults.legalStatus,
    similarProjectsCompleted:
      submissionValueToString(get("similarProjectsCompleted")) ||
      defaults.similarProjectsCompleted,
    yearsOfExperience:
      submissionValueToString(get("yearsOfExperience")) ||
      defaults.yearsOfExperience,
    totalCashReserves: submissionValueToFormNumber(get("totalCashReserves")),
    existingDebt: submissionValueToFormNumber(get("existingDebt")),
    assets,
    liabilities,
    realEstateOwned,
    recentlySoldProperties,
    declarations,
  };
};

type AddFieldFn = (key: string, value: unknown) => void;

export const appendResidentialBorrowerSubmission = (
  addField: AddFieldFn,
  borrower: ResidentialBorrowerFields & {
    phone: string;
    email: string;
    ssn: string;
    creditScore: string;
    dob?: string;
  },
  prefix = "",
) => {
  const p = prefix ? `${prefix}_` : "";

  addField(`${p}borrowerFirstName`, borrower.firstName);
  addField(`${p}borrowerLastName`, borrower.lastName);
  addField(`${p}entityOwnershipPercent`, borrower.entityOwnershipPercent);
  addField(`${p}legalStatus`, borrower.legalStatus);
  addField(`${p}similarProjectsCompleted`, borrower.similarProjectsCompleted);
  addField(`${p}yearsOfExperience`, borrower.yearsOfExperience);
  addField(`${p}totalCashReserves`, parseAmount(borrower.totalCashReserves));
  addField(`${p}existingDebt`, parseAmount(borrower.existingDebt));
  addField(`${p}phone`, borrower.phone);
  addField(`${p}email`, borrower.email?.toLowerCase());
  addField(`${p}ssn`, borrower.ssn);
  addField(`${p}dob`, borrower.dob || "");
  addField(`${p}creditScore`, borrower.creditScore);

  ASSET_FIELD_DEFS.forEach(({ key }) => {
    addField(`${p}asset_${key}`, parseAmount(borrower.assets[key]));
  });

  LIABILITY_FIELD_DEFS.forEach(({ key }) => {
    addField(`${p}liability_${key}`, parseAmount(borrower.liabilities[key]));
  });

  const totalAssets = sumBorrowerAssets(borrower.assets);
  const totalLiabilities = sumBorrowerLiabilities(borrower.liabilities);
  addField(`${p}totalAssets`, totalAssets);
  addField(`${p}totalLiabilities`, totalLiabilities);
  addField(`${p}netWorth`, totalAssets - totalLiabilities);

  borrower.realEstateOwned.forEach((entry, index) => {
    const derived = withSreoDerivedFields(entry);
    const sreoPrefix = `${p}sreo_${index}_`;
    addField(`${sreoPrefix}propertyAddress`, derived.propertyAddress);
    addField(`${sreoPrefix}entityNameOnTitle`, derived.entityNameOnTitle);
    addField(`${sreoPrefix}ownershipPercent`, derived.ownershipPercent);
    addField(`${sreoPrefix}propertyType`, derived.propertyType);
    addField(`${sreoPrefix}acquisitionDate`, derived.acquisitionDate);
    addField(`${sreoPrefix}purchaseDate`, derived.acquisitionDate);
    addField(`${sreoPrefix}purchasePrice`, parseAmount(derived.purchasePrice));
    addField(
      `${sreoPrefix}rehabUpgradeCost`,
      parseAmount(derived.rehabUpgradeCost),
    );
    addField(
      `${sreoPrefix}currentMarketValue`,
      parseAmount(derived.currentMarketValue),
    );
    addField(
      `${sreoPrefix}mortgageHolderNameAddress`,
      derived.mortgageHolderNameAddress,
    );
    addField(
      `${sreoPrefix}loanMortgageBalance`,
      parseAmount(derived.loanMortgageBalance),
    );
    addField(
      `${sreoPrefix}grossRentalIncome`,
      parseAmount(derived.grossRentalIncome),
    );
    addField(
      `${sreoPrefix}loanTaxInsurancePaymentYr`,
      parseAmount(derived.loanTaxInsurancePaymentYr),
    );
    addField(
      `${sreoPrefix}totalAnnualExpenses`,
      parseAmount(derived.totalAnnualExpenses),
    );
    addField(`${sreoPrefix}netRent`, calcSreoNetRent(derived));
    addField(`${sreoPrefix}totalEquity`, calcSreoTotalEquity(derived));
  });

  const sreoTotalEquity = sumScheduleTotalEquity(borrower.realEstateOwned);
  addField(`${p}sreoTotalEquity`, sreoTotalEquity);
  addField(`${p}sreoTotalMarketValue`, sreoTotalEquity);

  (borrower.recentlySoldProperties || []).forEach((entry, index) => {
    const derived = withSoldDerivedFields(entry);
    const soldPrefix = `${p}sold_${index}_`;
    addField(`${soldPrefix}propertyAddress`, derived.propertyAddress);
    addField(`${soldPrefix}entityNameOnTitle`, derived.entityNameOnTitle);
    addField(`${soldPrefix}ownershipPercent`, derived.ownershipPercent);
    addField(`${soldPrefix}propertyType`, derived.propertyType);
    addField(`${soldPrefix}purchaseDate`, derived.purchaseDate);
    addField(`${soldPrefix}soldDate`, derived.soldDate);
    addField(`${soldPrefix}purchasePrice`, parseAmount(derived.purchasePrice));
    addField(
      `${soldPrefix}rehabConstructionUpgradeCost`,
      parseAmount(derived.rehabConstructionUpgradeCost),
    );
    addField(
      `${soldPrefix}costOfBorrowing`,
      parseAmount(derived.costOfBorrowing),
    );
    addField(
      `${soldPrefix}totalProjectCost`,
      calcSoldTotalProjectCost(derived),
    );
    addField(`${soldPrefix}soldPrice`, parseAmount(derived.soldPrice));
    addField(`${soldPrefix}totalProfit`, calcSoldTotalProfit(derived));
  });

  DECLARATION_QUESTIONS.forEach(({ key }) => {
    addField(`${p}declaration_${key}`, borrower.declarations[key]);
  });
};
