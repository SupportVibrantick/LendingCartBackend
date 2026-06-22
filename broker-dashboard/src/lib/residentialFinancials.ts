export type FinancialYearColumn = "col0" | "col1" | "col2";

export type DscrCalculationMethod = "noi" | "proForma";

export interface YearTriple {
  col0: string;
  col1: string;
  col2: string;
}

export interface ProFormaNoiYear {
  id: number;
  amount: string;
}

export interface ResidentialFinancials {
  rentalProperty: boolean;
  hasRentalIncome: boolean;
  monthlyRent: string;
  grossRevenue: YearTriple;
  grossRentalIncome: YearTriple;
  vacancyCreditLoss: YearTriple;
  operatingExpenses: YearTriple;
  mortgageDebtService: YearTriple;
  effectiveGrossIncomeOverride: YearTriple;
  noiOverride: YearTriple;
  cashFlowAfterDebtOverride: YearTriple;
  proFormaNoiYears: ProFormaNoiYear[];
  dscrCalculationMethod: DscrCalculationMethod;
  annualPropertyTaxes: string;
  annualInsurance: string;
  hoaDues: string;
  inFloodZone: boolean;
  projectSummary: string;
  exitStrategy: string;
}

export const FINANCIAL_YEAR_COLUMNS: FinancialYearColumn[] = [
  "col0",
  "col1",
  "col2",
];

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

export const createEmptyYearTriple = (): YearTriple => ({
  col0: "",
  col1: "",
  col2: "",
});

export const createDefaultProFormaYears = (): ProFormaNoiYear[] =>
  [1, 2, 3].map((year) => ({
    id: year,
    amount: "",
  }));

export const createResidentialFinancialsDefaults = (): ResidentialFinancials => ({
  rentalProperty: false,
  hasRentalIncome: false,
  monthlyRent: "",
  grossRevenue: createEmptyYearTriple(),
  grossRentalIncome: createEmptyYearTriple(),
  vacancyCreditLoss: createEmptyYearTriple(),
  operatingExpenses: createEmptyYearTriple(),
  mortgageDebtService: createEmptyYearTriple(),
  effectiveGrossIncomeOverride: createEmptyYearTriple(),
  noiOverride: createEmptyYearTriple(),
  cashFlowAfterDebtOverride: createEmptyYearTriple(),
  proFormaNoiYears: createDefaultProFormaYears(),
  dscrCalculationMethod: "noi",
  annualPropertyTaxes: "",
  annualInsurance: "",
  hoaDues: "",
  inFloodZone: false,
  projectSummary: "",
  exitStrategy: "",
});

/** Calendar year used as the current (YTD) column — always derived from the system date. */
export const getCurrentFinancialReferenceYear = () => new Date().getFullYear();

export type FinancialYearColumnMeta = {
  column: FinancialYearColumn;
  year: number;
  label: string;
};

/** Three annual columns: current year (YTD), prior year, two years ago. */
export const getFinancialYearColumns = (
  referenceYear = getCurrentFinancialReferenceYear(),
): FinancialYearColumnMeta[] =>
  FINANCIAL_YEAR_COLUMNS.map((column, index) => {
    const year = referenceYear - index;
    return {
      column,
      year,
      label: index === 0 ? `${year} (YTD)` : String(year),
    };
  });

export const getFinancialYearLabels = (
  referenceYear = getCurrentFinancialReferenceYear(),
) => getFinancialYearColumns(referenceYear).map(({ label }) => label);

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

export const calcNoi = (financials: ResidentialFinancials, column: FinancialYearColumn) => {
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

export const getNoi = (financials: ResidentialFinancials, column: FinancialYearColumn) => {
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
  financials: ResidentialFinancials,
  column: FinancialYearColumn,
  calculated: number,
  override: YearTriple,
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

export const getResidentialDebtServiceForDscr = (financials: ResidentialFinancials) =>
  parseAmount(financials.mortgageDebtService.col0);

type AddFieldFn = (key: string, value: unknown) => void;

export const appendResidentialFinancialsSubmission = (
  addField: AddFieldFn,
  financials: ResidentialFinancials,
) => {
  const referenceYear = getCurrentFinancialReferenceYear();
  addField("financialReferenceYear", referenceYear);
  getFinancialYearColumns(referenceYear).forEach(({ column, year }) => {
    addField(`financialYear_${column}`, year);
  });

  addField("rentalProperty", financials.rentalProperty ? "yes" : "no");
  addField("hasRentalIncome", financials.hasRentalIncome ? "yes" : "no");
  addField("monthlyRent", parseAmount(financials.monthlyRent));
  addField("dscrCalculationMethod", financials.dscrCalculationMethod);

  ANNUAL_FINANCIAL_EDITABLE_ROWS.forEach(({ key }) => {
    FINANCIAL_YEAR_COLUMNS.forEach((column) => {
      addField(
        `financial_${key}_${column}`,
        parseAmount(financials[key][column]),
      );
    });
  });

  ANNUAL_FINANCIAL_CALCULATED_ROWS.forEach(({ overrideKey }) => {
    FINANCIAL_YEAR_COLUMNS.forEach((column) => {
      addField(
        `financial_${overrideKey}_${column}`,
        parseAmount(financials[overrideKey][column]),
      );
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
  addField(
    "grossRevenueActual",
    parseAmount(financials.grossRevenue.col0),
  );
  addField("annualTaxes", parseAmount(financials.annualPropertyTaxes));
  addField("insurancePremium", parseAmount(financials.annualInsurance));
  addField("floodZone", financials.inFloodZone ? "yes" : "no");
  addField("noiProforma", getProFormaNoiAverage(financials));
};
