export type FinancialYearColumn = string;

export type YearValues = Record<FinancialYearColumn, string>;

/** @deprecated Use YearValues — kept for gradual migration references */
export type YearTriple = YearValues;

export type DscrCalculationMethod = "noi" | "proForma";

export interface ProFormaNoiYear {
  id: number;
  amount: string;
}

export interface ResidentialFinancials {
  /** Number of annual financial columns (min 3: current YTD + 2 prior years). */
  financialYearColumnCount: number;
  rentalProperty: boolean;
  hasRentalIncome: boolean;
  monthlyRent: string;
  grossRevenue: YearValues;
  grossRentalIncome: YearValues;
  vacancyCreditLoss: YearValues;
  operatingExpenses: YearValues;
  mortgageDebtService: YearValues;
  effectiveGrossIncomeOverride: YearValues;
  noiOverride: YearValues;
  cashFlowAfterDebtOverride: YearValues;
  proFormaNoiYears: ProFormaNoiYear[];
  dscrCalculationMethod: DscrCalculationMethod;
  annualPropertyTaxes: string;
  annualInsurance: string;
  hoaDues: string;
  inFloodZone: boolean;
  projectSummary: string;
  exitStrategy: string;
}

export const DEFAULT_FINANCIAL_YEAR_COLUMN_COUNT = 3;
export const MIN_FINANCIAL_YEAR_COLUMN_COUNT = 3;

export function getFinancialYearColumnKeys(
  count = DEFAULT_FINANCIAL_YEAR_COLUMN_COUNT,
): FinancialYearColumn[] {
  const safeCount = Math.max(MIN_FINANCIAL_YEAR_COLUMN_COUNT, count);
  return Array.from({ length: safeCount }, (_, index) => `col${index}`);
}

/** Default three columns — use getFinancialYearColumnKeys(count) for dynamic tables. */
export const FINANCIAL_YEAR_COLUMNS: FinancialYearColumn[] =
  getFinancialYearColumnKeys(DEFAULT_FINANCIAL_YEAR_COLUMN_COUNT);

export const ANNUAL_FINANCIAL_EDITABLE_ROWS = [
  { key: "grossRevenue" as const, label: "Gross Revenue ($)" },
  { key: "grossRentalIncome" as const, label: "Gross Rental Income ($)" },
  { key: "vacancyCreditLoss" as const, label: "Vacancy & Credit Loss ($)" },
  { key: "operatingExpenses" as const, label: "Operating Expenses ($)" },
  { key: "mortgageDebtService" as const, label: "Mortgage / Debt Service ($)" },
];

export const ANNUAL_FINANCIAL_CALCULATED_ROWS = [
  {
    key: "effectiveGrossIncome" as const,
    label: "Effective Gross Income ($)",
    overrideKey: "effectiveGrossIncomeOverride" as const,
  },
  {
    key: "noi" as const,
    label: "NOI — Net Operating Income ($)",
    overrideKey: "noiOverride" as const,
  },
  {
    key: "cashFlowAfterDebt" as const,
    label: "Cash Flow After Debt Service ($)",
    overrideKey: "cashFlowAfterDebtOverride" as const,
  },
];

export const createEmptyYearValues = (
  count = DEFAULT_FINANCIAL_YEAR_COLUMN_COUNT,
): YearValues => {
  const values: YearValues = {};
  getFinancialYearColumnKeys(count).forEach((column) => {
    values[column] = "";
  });
  return values;
};

/** @deprecated Use createEmptyYearValues */
export const createEmptyYearTriple = createEmptyYearValues;

export const createDefaultProFormaYears = (): ProFormaNoiYear[] =>
  [1, 2, 3].map((year) => ({
    id: year,
    amount: "",
  }));

export const createResidentialFinancialsDefaults = (): ResidentialFinancials => ({
  financialYearColumnCount: DEFAULT_FINANCIAL_YEAR_COLUMN_COUNT,
  rentalProperty: false,
  hasRentalIncome: false,
  monthlyRent: "",
  grossRevenue: createEmptyYearValues(),
  grossRentalIncome: createEmptyYearValues(),
  vacancyCreditLoss: createEmptyYearValues(),
  operatingExpenses: createEmptyYearValues(),
  mortgageDebtService: createEmptyYearValues(),
  effectiveGrossIncomeOverride: createEmptyYearValues(),
  noiOverride: createEmptyYearValues(),
  cashFlowAfterDebtOverride: createEmptyYearValues(),
  proFormaNoiYears: createDefaultProFormaYears(),
  dscrCalculationMethod: "noi",
  annualPropertyTaxes: "",
  annualInsurance: "",
  hoaDues: "",
  inFloodZone: false,
  projectSummary: "",
  exitStrategy: "",
});

const appendYearColumn = (
  financials: ResidentialFinancials,
  column: FinancialYearColumn,
): ResidentialFinancials => {
  const withColumn = (values: YearValues) => ({ ...values, [column]: "" });
  return {
    ...financials,
    grossRevenue: withColumn(financials.grossRevenue),
    grossRentalIncome: withColumn(financials.grossRentalIncome),
    vacancyCreditLoss: withColumn(financials.vacancyCreditLoss),
    operatingExpenses: withColumn(financials.operatingExpenses),
    mortgageDebtService: withColumn(financials.mortgageDebtService),
    effectiveGrossIncomeOverride: withColumn(
      financials.effectiveGrossIncomeOverride,
    ),
    noiOverride: withColumn(financials.noiOverride),
    cashFlowAfterDebtOverride: withColumn(financials.cashFlowAfterDebtOverride),
  };
};

const stripYearColumn = (
  financials: ResidentialFinancials,
  column: FinancialYearColumn,
): ResidentialFinancials => {
  const withoutColumn = (values: YearValues) => {
    const next = { ...values };
    delete next[column];
    return next;
  };
  return {
    ...financials,
    grossRevenue: withoutColumn(financials.grossRevenue),
    grossRentalIncome: withoutColumn(financials.grossRentalIncome),
    vacancyCreditLoss: withoutColumn(financials.vacancyCreditLoss),
    operatingExpenses: withoutColumn(financials.operatingExpenses),
    mortgageDebtService: withoutColumn(financials.mortgageDebtService),
    effectiveGrossIncomeOverride: withoutColumn(
      financials.effectiveGrossIncomeOverride,
    ),
    noiOverride: withoutColumn(financials.noiOverride),
    cashFlowAfterDebtOverride: withoutColumn(
      financials.cashFlowAfterDebtOverride,
    ),
  };
};

/** Adds the next historical year column (e.g. 2023 after 2026/2025/2024). */
export const addFinancialYearColumn = (
  financials: ResidentialFinancials,
): ResidentialFinancials => {
  const nextCount = financials.financialYearColumnCount + 1;
  const newColumn = `col${nextCount - 1}`;
  return appendYearColumn(
    { ...financials, financialYearColumnCount: nextCount },
    newColumn,
  );
};

/** Removes the oldest added year column (rightmost). No-op when only 3 columns remain. */
export const removeLastFinancialYearColumn = (
  financials: ResidentialFinancials,
): ResidentialFinancials => {
  if (financials.financialYearColumnCount <= MIN_FINANCIAL_YEAR_COLUMN_COUNT) {
    return financials;
  }
  const lastColumn = `col${financials.financialYearColumnCount - 1}`;
  return stripYearColumn(
    {
      ...financials,
      financialYearColumnCount: financials.financialYearColumnCount - 1,
    },
    lastColumn,
  );
};

/** Calendar year used as the current (YTD) column — always derived from the system date. */
export const getCurrentFinancialReferenceYear = () => new Date().getFullYear();

export type FinancialYearColumnMeta = {
  column: FinancialYearColumn;
  year: number;
  label: string;
};

export const getFinancialYearColumns = (
  referenceYear = getCurrentFinancialReferenceYear(),
  columnCount = DEFAULT_FINANCIAL_YEAR_COLUMN_COUNT,
): FinancialYearColumnMeta[] =>
  getFinancialYearColumnKeys(columnCount).map((column, index) => {
    const year = referenceYear - index;
    return {
      column,
      year,
      label: index === 0 ? `${year} (YTD)` : String(year),
    };
  });

export const getFinancialYearLabels = (
  referenceYear = getCurrentFinancialReferenceYear(),
  columnCount = DEFAULT_FINANCIAL_YEAR_COLUMN_COUNT,
) =>
  getFinancialYearColumns(referenceYear, columnCount).map(({ label }) => label);

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

export const formatCurrencyDisplay = (value: number) =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

export const calcEffectiveGrossIncome = (
  financials: ResidentialFinancials,
  column: FinancialYearColumn,
) =>
  parseAmount(financials.grossRevenue[column]) +
  parseAmount(financials.grossRentalIncome[column]) -
  parseAmount(financials.vacancyCreditLoss[column]);

export const calcNoi = (
  financials: ResidentialFinancials,
  column: FinancialYearColumn,
) => {
  const egi = getEffectiveGrossIncome(financials, column);
  return egi - parseAmount(financials.operatingExpenses[column]);
};

export const calcCashFlowAfterDebt = (
  financials: ResidentialFinancials,
  column: FinancialYearColumn,
) => {
  const noi = getNoi(financials, column);
  return noi - parseAmount(financials.mortgageDebtService[column]);
};

export const getEffectiveGrossIncome = (
  financials: ResidentialFinancials,
  column: FinancialYearColumn,
) => {
  const override = financials.effectiveGrossIncomeOverride[column];
  if (override?.trim()) return parseAmount(override);
  return calcEffectiveGrossIncome(financials, column);
};

export const getNoi = (
  financials: ResidentialFinancials,
  column: FinancialYearColumn,
) => {
  const override = financials.noiOverride[column];
  if (override?.trim()) return parseAmount(override);
  return calcNoi(financials, column);
};

export const getCashFlowAfterDebt = (
  financials: ResidentialFinancials,
  column: FinancialYearColumn,
) => {
  const override = financials.cashFlowAfterDebtOverride[column];
  if (override?.trim()) return parseAmount(override);
  return calcCashFlowAfterDebt(financials, column);
};

export const getDisplayCalculatedValue = (
  _financials: ResidentialFinancials,
  column: FinancialYearColumn,
  calculated: number,
  override: YearValues,
) => {
  const overrideValue = override[column];
  if (overrideValue?.trim()) return overrideValue;
  return calculated > 0 ? formatCurrencyDisplay(calculated) : "";
};

export const getProFormaNoiAverage = (financials: ResidentialFinancials) => {
  const amounts = financials.proFormaNoiYears
    .map((year) => parseAmount(year.amount))
    .filter((amount) => amount > 0);
  if (amounts.length === 0) return 0;
  return amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
};

export const getResidentialNoiForDscr = (financials: ResidentialFinancials) => {
  if (financials.dscrCalculationMethod === "proForma") {
    return getProFormaNoiAverage(financials);
  }
  return getNoi(financials, "col0");
};

export const getResidentialDebtServiceForDscr = (
  financials: ResidentialFinancials,
) => parseAmount(financials.mortgageDebtService.col0);

type AddFieldFn = (key: string, value: unknown) => void;

export const appendResidentialFinancialsSubmission = (
  addField: AddFieldFn,
  financials: ResidentialFinancials,
) => {
  const referenceYear = getCurrentFinancialReferenceYear();
  const columnKeys = getFinancialYearColumnKeys(
    financials.financialYearColumnCount,
  );

  addField("financialReferenceYear", referenceYear);
  addField("financialYearColumnCount", financials.financialYearColumnCount);
  getFinancialYearColumns(
    referenceYear,
    financials.financialYearColumnCount,
  ).forEach(({ column, year }) => {
    addField(`financialYear_${column}`, year);
  });

  addField("rentalProperty", financials.rentalProperty ? "yes" : "no");
  addField("hasRentalIncome", financials.hasRentalIncome ? "yes" : "no");
  addField("monthlyRent", parseAmount(financials.monthlyRent));
  addField("dscrCalculationMethod", financials.dscrCalculationMethod);

  ANNUAL_FINANCIAL_EDITABLE_ROWS.forEach(({ key }) => {
    columnKeys.forEach((column) => {
      const raw = String(financials[key][column] || "").trim();
      if (!raw) return;
      addField(`financial_${key}_${column}`, parseAmount(raw));
    });
  });

  ANNUAL_FINANCIAL_CALCULATED_ROWS.forEach(({ overrideKey }) => {
    columnKeys.forEach((column) => {
      const rawOverride = String(financials[overrideKey][column] || "").trim();
      if (rawOverride) {
        addField(
          `financial_${overrideKey}_${column}`,
          parseAmount(rawOverride),
        );
      }
      addField(
        `financial_${overrideKey}_${column}_computed`,
        overrideKey === "effectiveGrossIncomeOverride"
          ? calcEffectiveGrossIncome(financials, column)
          : overrideKey === "noiOverride"
            ? calcNoi(financials, column)
            : calcCashFlowAfterDebt(financials, column),
      );
    });
  });

  financials.proFormaNoiYears.forEach((year, index) => {
    addField(`proFormaNoi_year_${index + 1}`, parseAmount(year.amount));
  });

  addField("proFormaNoiAverage", getProFormaNoiAverage(financials));
  addField("annualPropertyTaxes", parseAmount(financials.annualPropertyTaxes));
  addField("annualInsurance", parseAmount(financials.annualInsurance));
  addField("hoaDues", parseAmount(financials.hoaDues));
  addField("inFloodZone", financials.inFloodZone ? "yes" : "no");
  addField("projectSummary", financials.projectSummary);
  addField("exitStrategy", financials.exitStrategy);

  addField("noiActual", getNoi(financials, "col0"));
  addField("grossRevenueActual", parseAmount(financials.grossRevenue.col0));
  addField("annualTaxes", parseAmount(financials.annualPropertyTaxes));
  addField("insurancePremium", parseAmount(financials.annualInsurance));
  addField("floodZone", financials.inFloodZone ? "yes" : "no");
  addField("noiProforma", getProFormaNoiAverage(financials));
};

export const detectFinancialYearColumnCount = (
  fields: { fieldKey?: string | null; value?: unknown }[],
): number => {
  const stored = fields.find((f) => f.fieldKey === "financialYearColumnCount");
  if (stored?.value != null && stored.value !== "") {
    const parsed = Number(stored.value);
    if (parsed >= MIN_FINANCIAL_YEAR_COLUMN_COUNT) return parsed;
  }

  let maxIndex = MIN_FINANCIAL_YEAR_COLUMN_COUNT - 1;
  fields.forEach((field) => {
    const key = field.fieldKey || "";
    const match = key.match(/_col(\d+)$/);
    if (match) {
      maxIndex = Math.max(maxIndex, Number(match[1]));
    }
  });

  return maxIndex + 1;
};

export const loadFinancialYearValues = (
  getFieldValue: (key: string) => unknown,
  prefix: string,
  columnCount: number,
  asFormNumber: (val: unknown) => string,
): YearValues => {
  const values: YearValues = {};
  getFinancialYearColumnKeys(columnCount).forEach((column) => {
    values[column] = asFormNumber(getFieldValue(`${prefix}_${column}`));
  });
  return values;
};

/**
 * Hydrate annual financial amounts. Stored `0` from older submits often meant
 * "empty" (blank field persisted as 0) — treat as blank so calcs/display work.
 */
export const asFinancialAmountFormValue = (val: unknown): string => {
  if (val === undefined || val === null || val === "") return "";
  if (typeof val === "number") {
    if (!Number.isFinite(val) || val === 0) return "";
    return val.toLocaleString("en-US");
  }
  const text = String(val).trim().replace(/,/g, "");
  if (text === "") return "";
  const numeric = Number(text);
  if (!Number.isFinite(numeric) || numeric === 0) return "";
  return numeric.toLocaleString("en-US");
};

/** @deprecated Prefer asFinancialAmountFormValue — same behavior for overrides. */
export const asFinancialOverrideFormValue = asFinancialAmountFormValue;

/** Persist amount only when the user entered something (avoid blank → 0). */
export const parseOptionalAmount = (value: string) => {
  if (!String(value || "").trim()) return null;
  return parseAmount(value);
};
