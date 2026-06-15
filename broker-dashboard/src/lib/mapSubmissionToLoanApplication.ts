import {
  CATEGORY_LOAN_TYPES,
  type FormDataType,
  type LoanCategory,
} from "../pages/LoanApplication/LoanApplication";

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
  };
}

export function mapSubmissionToLoanApplication(fields: SubmissionField[]) {
  const formData = createEmptyFormData();
  const dynamicFormData: Record<string, unknown> = {};

  const firstName = asString(getFieldValue(fields, "borrowerFirstName"));
  const lastName = asString(getFieldValue(fields, "borrowerLastName"));

  formData.borrower = {
    ...formData.borrower,
    name: [firstName, lastName].filter(Boolean).join(" "),
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
    currentMarketValue: asFormNumber(getFieldValue(fields, "currentMarketValue")),
    purchasePrice: asFormNumber(getFieldValue(fields, "purchasePrice")),
    purchaseDate: asString(getFieldValue(fields, "purchaseDate")),
    totalAssets: asFormNumber(getFieldValue(fields, "totalAssets")),
    totalLiabilities: asFormNumber(getFieldValue(fields, "totalLiabilities")),
    afterRepairValue: asFormNumber(getFieldValue(fields, "afterRepairValue")),
    propertyType: asString(getFieldValue(fields, "propertyType")),
    subPropertyType: asString(getFieldValue(fields, "subPropertyType")),
    recourse: asString(getFieldValue(fields, "recourse")),
    businessAddress: asString(getFieldValue(fields, "propertyAddress")),
    city: asString(getFieldValue(fields, "propertyCity")),
    state: asString(getFieldValue(fields, "propertyState")),
    zip: asString(getFieldValue(fields, "propertyZip")),
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
  };

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

  formData.coBorrowers = Array.from(coBorrowerMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([, borrower]) => ({
      id: borrower.id,
      name: asString(borrower.name),
      entityName: asString(borrower.entityName),
      phone: asString(borrower.phone),
      email: asString(borrower.email),
      employer: asString(borrower.employer),
      dob: asString(borrower.dob),
      ssn: asString(borrower.ssn),
      creditScore: asString(borrower.creditScore),
      address: asString(borrower.address),
      city: asString(borrower.city),
      state: asString(borrower.state),
      mailingAddress: asString(borrower.mailingAddress),
      currentMarketValue: asString(borrower.currentMarketValue),
      purchasePrice: asString(borrower.purchasePrice),
      interestRate: asString(borrower.interestRate),
      noi: asString(borrower.noi),
      totalAssets: asString(borrower.totalAssets),
      totalLiabilities: asString(borrower.totalLiabilities),
    }));

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
