import {
  CATEGORY_LOAN_TYPES,
  type FormDataType,
  type LoanCategory,
} from "../pages/LoanApplication/LoanApplication";
import { createResidentialBorrowerDefaults, hydrateResidentialBorrowerFromFields } from "./residentialBorrower";
import { createSbaEntityDefaults } from "./sba7aAcquisition";
import {
  ANNUAL_FINANCIAL_CALCULATED_ROWS,
  ANNUAL_FINANCIAL_EDITABLE_ROWS,
  createResidentialFinancialsDefaults,
  FINANCIAL_YEAR_COLUMNS,
  type FinancialYearColumn,
  type ResidentialFinancials,
  type YearTriple,
} from "./residentialFinancials";

type SubmissionField = {
  fieldId?: string | null;
  fieldKey?: string | null;
  value?: unknown;
  source?: string;
};

const STATIC_SUBMIT_KEYS = new Set([
  "borrowerFirstName",
  "borrowerLastName",
  "companyName",
  "email",
  "phone",
  "creditScore",
  "borrowerCity",
  "borrowerState",
  "borrowerCountry",
  "dob",
  "ssn",
  "address",
  "mailingAddress",
  "employer",
  "loanProductCode",
  "amountRequested",
  "interestRate",
  "purpose",
  "propertyType",
  "subPropertyType",
  "recourse",
  "propertyAddress",
  "propertyCity",
  "propertyState",
  "propertyZip",
  "propertyCountry",
  "loanTerm",
  "noiActual",
  "entityLegalName",
  "entityType",
  "dba",
  "formationDate",
  "yearsInBusiness",
  "currentMarketValue",
  "afterRepairValue",
  "purchasePrice",
  "purchaseDate",
  "totalAssets",
  "totalLiabilities",
  "monthlyRent",
  "grossRevenueActual",
  "grossRevenueProforma",
  "noiProforma",
  "annualTaxes",
  "floodZone",
  "insurancePremium",
  "hoaDues",
  "ltvPercentage",
  "ltcPercentage",
  "arvPercentage",
  "dscr",
  "netWorth",
]);

const CO_BORROWER_SKIP_KEYS = new Set(["netWorth", "ltv", "ltc", "dscr"]);

const parseValue = (val: unknown): unknown => {
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }
  return val;
};

const asString = (val: unknown): string => {
  if (val === undefined || val === null) return "";
  if (typeof val === "boolean") return val ? "true" : "false";
  return String(val);
};

const asFormNumber = (val: unknown): string => {
  if (val === undefined || val === null || val === "") return "";
  if (typeof val === "number" && Number.isFinite(val)) {
    return val.toLocaleString("en-US");
  }
  const raw = asString(val).replace(/,/g, "");
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return asString(val);
  return numeric.toLocaleString("en-US");
};

const getFieldValue = (fields: SubmissionField[], key: string) => {
  const field = fields.find((item) => item.fieldKey === key);
  return field ? parseValue(field.value) : undefined;
};

const getFieldValueByKeys = (fields: SubmissionField[], keys: string[]) => {
  for (const key of keys) {
    const value = getFieldValue(fields, key);
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return undefined;
};

const normalizeFloodZone = (val: unknown): string => {
  if (val === undefined || val === null || val === "") return "";

  if (typeof val === "boolean") {
    return val ? "yes" : "no";
  }

  const normalized = asString(val).trim().toLowerCase();
  if (["yes", "y", "true", "1"].includes(normalized)) return "yes";
  if (["no", "n", "false", "0"].includes(normalized)) return "no";

  return normalized;
};

const normalizeYesNo = (val: unknown): boolean => {
  if (typeof val === "boolean") return val;
  const normalized = asString(val).trim().toLowerCase();
  return ["yes", "y", "true", "1"].includes(normalized);
};

const loadFinancialYearTriple = (
  fields: SubmissionField[],
  prefix: string,
): YearTriple => {
  const triple = {} as YearTriple;
  FINANCIAL_YEAR_COLUMNS.forEach((column: FinancialYearColumn) => {
    triple[column] = asFormNumber(
      getFieldValue(fields, `${prefix}_${column}`),
    );
  });
  return triple;
};

const mapResidentialFinancialsFromFields = (
  fields: SubmissionField[],
): ResidentialFinancials => {
  const financials = createResidentialFinancialsDefaults();

  financials.rentalProperty = normalizeYesNo(getFieldValue(fields, "rentalProperty"));
  financials.hasRentalIncome = normalizeYesNo(
    getFieldValue(fields, "hasRentalIncome"),
  );
  financials.monthlyRent = asFormNumber(getFieldValue(fields, "monthlyRent"));
  financials.dscrCalculationMethod =
    asString(getFieldValue(fields, "dscrCalculationMethod")) === "proForma"
      ? "proForma"
      : "noi";
  financials.annualPropertyTaxes = asFormNumber(
    getFieldValue(fields, "annualTaxes"),
  );
  financials.annualInsurance = asFormNumber(
    getFieldValue(fields, "insurancePremium"),
  );
  financials.hoaDues = asFormNumber(getFieldValue(fields, "hoaDues"));
  financials.inFloodZone = normalizeYesNo(
    getFieldValueByKeys(fields, ["inFloodZone", "floodZone"]),
  );
  financials.projectSummary = asString(getFieldValue(fields, "projectSummary"));
  financials.exitStrategy = asString(getFieldValue(fields, "exitStrategy"));

  ANNUAL_FINANCIAL_EDITABLE_ROWS.forEach(({ key }) => {
    financials[key] = loadFinancialYearTriple(fields, `financial_${key}`);
  });

  ANNUAL_FINANCIAL_CALCULATED_ROWS.forEach(({ overrideKey }) => {
    financials[overrideKey] = loadFinancialYearTriple(
      fields,
      `financial_${overrideKey}`,
    );
  });

  const proFormaYears = [1, 2, 3].map((yearIndex) => ({
    id: yearIndex,
    amount: asFormNumber(
      getFieldValue(fields, `proFormaNoi_year_${yearIndex}`),
    ),
  }));

  if (proFormaYears.some((year) => year.amount)) {
    financials.proFormaNoiYears = proFormaYears;
  }

  return financials;
};

export function inferCategoryFromProduct(productCode: string): LoanCategory {
  for (const [category, products] of Object.entries(CATEGORY_LOAN_TYPES)) {
    if (products.includes(productCode)) {
      return category as LoanCategory;
    }
  }
  return "";
};

export function createEmptyFormData(): FormDataType {
  return {
    borrower: {
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
      rehabCost: "",
      constructionCost: "",
      propertyType: "",
      subPropertyType: "",
      recourse: "",
      businessAddress: "",
      city: "",
      state: "",
      zip: "",
      numberOfUnits: "",
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
  };
}

export function mapSubmissionToLoanApplication(fields: SubmissionField[]) {
  const formData = createEmptyFormData();
  const dynamicFormData: Record<string, unknown> = {};

  const residentialBorrower = hydrateResidentialBorrowerFromFields(fields);

  formData.borrower = {
    ...formData.borrower,
    ...residentialBorrower,
    name:
      [residentialBorrower.firstName, residentialBorrower.lastName]
        .filter(Boolean)
        .join(" ") || formData.borrower.name,
    entityName: asString(getFieldValue(fields, "companyName")),
    email: asString(getFieldValue(fields, "email")),
    phone: asString(getFieldValue(fields, "phone")),
    employer: asString(getFieldValue(fields, "employer")),
    dob: asString(getFieldValue(fields, "dob")),
    ssn: asString(getFieldValue(fields, "ssn")),
    creditScore: asString(getFieldValue(fields, "creditScore")),
    address: asString(getFieldValue(fields, "address")),
    city: asString(getFieldValue(fields, "borrowerCity")),
    state: asString(getFieldValue(fields, "borrowerState")),
    mailingAddress: asString(getFieldValue(fields, "mailingAddress")),
  };

  formData.loanRequest = {
    ...formData.loanRequest,
    purpose: asString(getFieldValue(fields, "purpose")),
    amount: asFormNumber(getFieldValue(fields, "amountRequested")),
    interestRate: asString(getFieldValue(fields, "interestRate")),
    sellerFinancing:
      asString(getFieldValue(fields, "sellerFinancing")) || "no",
    sellerNoteAmount: asFormNumber(getFieldValue(fields, "sellerNoteAmount")),
    estimatedClosingDate: asString(
      getFieldValue(fields, "estimatedClosingDate"),
    ),
    rateType: asString(getFieldValue(fields, "rateType")) || "FIXED",
    brokerPoints: asString(getFieldValue(fields, "brokerPoints")),
    amortization: asString(getFieldValue(fields, "amortization")),
    currentMarketValue: asFormNumber(getFieldValue(fields, "currentMarketValue")),
    purchasePrice: asFormNumber(getFieldValue(fields, "purchasePrice")),
    rehabCost: asFormNumber(getFieldValue(fields, "rehabBudget")),
    constructionCost: asFormNumber(getFieldValue(fields, "constructionBudget")),
    purchaseDate: asString(getFieldValue(fields, "purchaseDate")),
    totalAssets: asFormNumber(getFieldValue(fields, "totalAssets")),
    totalLiabilities: asFormNumber(getFieldValue(fields, "totalLiabilities")),
    afterRepairValue: asFormNumber(getFieldValue(fields, "afterRepairValue")),
    propertyType: asString(
      getFieldValueByKeys(fields, [
        "propertyType",
        "businessIndustry",
        "business_industry",
      ]),
    ),
    subPropertyType: asString(getFieldValue(fields, "subPropertyType")),
    recourse: asString(getFieldValue(fields, "recourse")),
    businessAddress: asString(getFieldValue(fields, "propertyAddress")),
    city: asString(getFieldValue(fields, "propertyCity")),
    state: asString(getFieldValue(fields, "propertyState")),
    zip: asString(getFieldValue(fields, "propertyZip")),
    numberOfUnits: asString(getFieldValue(fields, "numberOfUnits")),
  };

  formData.loanTermIncome = {
    ...formData.loanTermIncome,
    loanTerm: asString(getFieldValue(fields, "loanTerm")),
    monthlyRent: asFormNumber(getFieldValue(fields, "monthlyRent")),
    grossRevenueActual: asFormNumber(getFieldValue(fields, "grossRevenueActual")),
    grossRevenueProforma: asFormNumber(
      getFieldValue(fields, "grossRevenueProforma"),
    ),
    noiActual: asFormNumber(getFieldValue(fields, "noiActual")),
    noiProforma: asFormNumber(getFieldValue(fields, "noiProforma")),
    annualTaxes: asFormNumber(getFieldValue(fields, "annualTaxes")),
    floodZone: normalizeFloodZone(
      getFieldValueByKeys(fields, [
        "floodZone",
        "propertyInFloodZone",
        "propertyFloodZone",
        "flood_zone",
      ]),
    ),
    insurancePremium: asFormNumber(getFieldValue(fields, "insurancePremium")),
    hoaDues: asFormNumber(getFieldValue(fields, "hoaDues")),
  };

  formData.entity = {
    ...formData.entity,
    legalName: asString(getFieldValue(fields, "entityLegalName")),
    entityType: asString(getFieldValue(fields, "entityType")),
    dba: asString(getFieldValue(fields, "dba")),
    formationDate: asString(getFieldValue(fields, "formationDate")),
    yearsInBusiness: asString(getFieldValue(fields, "yearsInBusiness")),
    ebitdaWithNoi: asFormNumber(getFieldValue(fields, "ebitda")),
    naicsCode: asString(
      getFieldValueByKeys(fields, ["naicsCode", "naics", "naics_code"]),
    ),
    goodwillAmount: asFormNumber(
      getFieldValueByKeys(fields, ["goodwillAmount", "goodwill"]),
    ),
    inventoryIncluded: normalizeYesNo(
      getFieldValueByKeys(fields, ["inventoryIncluded", "inventory_included"]),
    ),
    equipmentIncluded: normalizeYesNo(
      getFieldValueByKeys(fields, ["equipmentIncluded", "equipment_included"]),
    ),
    inventoryValue: asFormNumber(
      getFieldValueByKeys(fields, ["inventoryValue", "inventory_value"]),
    ),
    equipmentValue: asFormNumber(
      getFieldValueByKeys(fields, ["equipmentValue", "equipment_value"]),
    ),
  };

  formData.financials = mapResidentialFinancialsFromFields(fields);

  const coBorrowerMap = new Map<
    number,
    Record<string, string | number> & { id: number }
  >();

  fields.forEach((field) => {
    const fieldKey = field.fieldKey || "";
    const coMatch = fieldKey.match(/^coBorrower_(\d+)_(.+)$/);
    if (!coMatch) return;

    const index = Number(coMatch[1]);
    const suffix = coMatch[2];
    if (CO_BORROWER_SKIP_KEYS.has(suffix)) return;

    if (!coBorrowerMap.has(index)) {
      coBorrowerMap.set(index, { id: Date.now() + index });
    }

    const entry = coBorrowerMap.get(index)!;
    const rawValue = parseValue(field.value);

    if (
      [
        "currentMarketValue",
        "purchasePrice",
        "noi",
        "totalAssets",
        "totalLiabilities",
      ].includes(suffix)
    ) {
      entry[suffix] = asFormNumber(rawValue);
      return;
    }

    entry[suffix] = asString(rawValue);
  });

  const coBorrowerIndices = new Set<number>();
  fields.forEach((field) => {
    const match = (field.fieldKey || "").match(/^coBorrower_(\d+)_/);
    if (match) coBorrowerIndices.add(Number(match[1]));
  });
  coBorrowerMap.forEach((_, index) => coBorrowerIndices.add(index));

  formData.coBorrowers = Array.from(coBorrowerIndices)
    .sort((a, b) => a - b)
    .map((index) => {
      const prefix = `coBorrower_${index}`;
      const residential = hydrateResidentialBorrowerFromFields(fields, prefix);
      const legacy = coBorrowerMap.get(index);
      const coFirstName =
        residential.firstName || asString(legacy?.firstName);
      const coLastName = residential.lastName || asString(legacy?.lastName);

      return {
        id: legacy?.id ?? Date.now() + index,
        ...residential,
        firstName: coFirstName,
        lastName: coLastName,
        name:
          asString(legacy?.name) ||
          [coFirstName, coLastName].filter(Boolean).join(" "),
        entityName: asString(legacy?.entityName),
        phone:
          asString(legacy?.phone) ||
          asString(getFieldValue(fields, `${prefix}_phone`)),
        email:
          asString(legacy?.email) ||
          asString(getFieldValue(fields, `${prefix}_email`)),
        employer: asString(legacy?.employer),
        dob: asString(legacy?.dob),
        ssn:
          asString(legacy?.ssn) ||
          asString(getFieldValue(fields, `${prefix}_ssn`)),
        creditScore:
          asString(legacy?.creditScore) ||
          asString(getFieldValue(fields, `${prefix}_creditScore`)),
        address: asString(legacy?.address),
        city: asString(legacy?.city),
        state: asString(legacy?.state),
        mailingAddress: asString(legacy?.mailingAddress),
        currentMarketValue: asString(legacy?.currentMarketValue),
        purchasePrice: asString(legacy?.purchasePrice),
        interestRate: asString(legacy?.interestRate),
        noi: asString(legacy?.noi),
        totalAssets: asString(legacy?.totalAssets),
        totalLiabilities: asString(legacy?.totalLiabilities),
      };
    });

  fields.forEach((field) => {
    if (!field.fieldId) return;

    const fieldKey = field.fieldKey || "";
    if (STATIC_SUBMIT_KEYS.has(fieldKey)) return;
    if (fieldKey.startsWith("coBorrower_")) return;

    dynamicFormData[field.fieldId] = parseValue(field.value);
  });

  const selectedProduct = asString(getFieldValue(fields, "loanProductCode"));
  const selectedCategory = inferCategoryFromProduct(selectedProduct);

  return {
    formData,
    dynamicFormData,
    selectedProduct,
    selectedCategory,
  };
}
