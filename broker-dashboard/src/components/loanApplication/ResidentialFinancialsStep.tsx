import { Plus, X } from "lucide-react";
import {
  ANNUAL_FINANCIAL_CALCULATED_ROWS,
  ANNUAL_FINANCIAL_EDITABLE_ROWS,
  addFinancialYearColumn,
  calcCashFlowAfterDebt,
  calcEffectiveGrossIncome,
  calcNoi,
  formatCurrencyDisplay,
  formatCurrencyInput,
  getDisplayCalculatedValue,
  getFinancialYearColumnKeys,
  getFinancialYearColumns,
  MIN_FINANCIAL_YEAR_COLUMN_COUNT,
  removeLastFinancialYearColumn,
  type FinancialYearColumn,
  type ResidentialFinancials,
} from "../../lib/residentialFinancials";

type ResidentialFinancialsStepProps = {
  financials: ResidentialFinancials;
  onChange: (financials: ResidentialFinancials) => void;
  annualDebtServiceDefault?: number;
};

const ToggleSwitch = ({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition ${
      disabled
        ? "cursor-not-allowed bg-slate-200 opacity-50 dark:bg-slate-700"
        : checked
          ? "bg-[#2C92D5]"
          : "bg-slate-200 dark:bg-slate-700"
    }`}
  >
    <span
      className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
        checked ? "translate-x-5" : "translate-x-0"
      }`}
    />
  </button>
);

const CurrencyInput = ({
  value,
  onChange,
  shaded = false,
  italic = false,
}: {
  value: string;
  onChange: (value: string) => void;
  shaded?: boolean;
  italic?: boolean;
}) => (
  <div className="relative">
    <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">
      $
    </span>
    <input
      type="text"
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(formatCurrencyInput(e.target.value))}
      placeholder="0"
      className={`w-full rounded-md border py-1 pl-5 pr-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${
        shaded
          ? "border-slate-200 bg-slate-100 italic text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          : "border-slate-300 bg-white"
      } ${italic ? "italic" : ""}`}
    />
  </div>
);

export default function ResidentialFinancialsStep({
  financials,
  onChange,
  annualDebtServiceDefault = 0,
}: ResidentialFinancialsStepProps) {
  const yearColumns = getFinancialYearColumns(
    undefined,
    financials.financialYearColumnCount,
  );
  const columnKeys = getFinancialYearColumnKeys(
    financials.financialYearColumnCount,
  );

  const patch = (partial: Partial<ResidentialFinancials>) =>
    onChange({ ...financials, ...partial });

  const annualDebtServiceDisplay =
    annualDebtServiceDefault > 0
      ? formatCurrencyDisplay(annualDebtServiceDefault)
      : "";

  const patchYearTriple = (
    key: keyof Pick<
      ResidentialFinancials,
      | "grossRevenue"
      | "grossRentalIncome"
      | "vacancyCreditLoss"
      | "operatingExpenses"
      | "mortgageDebtService"
      | "effectiveGrossIncomeOverride"
      | "noiOverride"
      | "cashFlowAfterDebtOverride"
    >,
    column: FinancialYearColumn,
    value: string,
  ) => {
    patch({
      [key]: {
        ...financials[key],
        [column]: value,
      },
    });
  };

  const handleRentalPropertyChange = (checked: boolean) => {
    patch({
      rentalProperty: checked,
      hasRentalIncome: checked ? financials.hasRentalIncome : false,
      monthlyRent: checked ? financials.monthlyRent : "",
    });
  };

  return (
    <div className="mt-5 space-y-6">
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Rental Income
        </p>

        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-700">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Rental Property?
            </span>
            <ToggleSwitch
              checked={financials.rentalProperty}
              onChange={handleRentalPropertyChange}
            />
          </div>

          {financials.rentalProperty && (
            <>
              <div className="ml-4 flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-700">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Does this property have rental income?
                </span>
                <ToggleSwitch
                  checked={financials.hasRentalIncome}
                  onChange={(checked) =>
                    patch({
                      hasRentalIncome: checked,
                      monthlyRent: checked ? financials.monthlyRent : "",
                    })
                  }
                />
              </div>

              {financials.hasRentalIncome && (
                <div className="ml-4 max-w-sm">
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    Monthly Rent ($)
                  </label>
                  <CurrencyInput
                    value={financials.monthlyRent}
                    onChange={(value) => patch({ monthlyRent: value })}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Annual Financials
        </p>

        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50">
                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">
                  Metric
                </th>
                {yearColumns.map(({ column, label }, index) => (
                  <th
                    key={column}
                    className="min-w-[120px] px-3 py-3 text-left font-semibold text-slate-600 dark:text-slate-300"
                  >
                    <div className="flex items-center gap-1">
                      <span>{label}</span>
                      {index >= MIN_FINANCIAL_YEAR_COLUMN_COUNT &&
                        index === yearColumns.length - 1 && (
                          <button
                            type="button"
                            title={`Remove ${label}`}
                            onClick={() =>
                              onChange(removeLastFinancialYearColumn(financials))
                            }
                            className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-red-500 dark:hover:bg-slate-700"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ANNUAL_FINANCIAL_EDITABLE_ROWS.map(({ key, label }) => (
                <tr
                  key={key}
                  className="border-b border-slate-100 dark:border-slate-800"
                >
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">
                    {label}
                  </td>
                  {columnKeys.map((column, columnIndex) => {
                    const isInterimDebtServiceColumn =
                      key === "mortgageDebtService" && columnIndex === 0;
                    const inputValue =
                      isInterimDebtServiceColumn && !financials[key][column]?.trim()
                        ? annualDebtServiceDisplay
                        : (financials[key][column] ?? "");

                    return (
                      <td key={column} className="px-3 py-2">
                        <CurrencyInput
                          value={inputValue}
                          onChange={(value) => patchYearTriple(key, column, value)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}

              {ANNUAL_FINANCIAL_CALCULATED_ROWS.map(
                ({ key, label, overrideKey }) => (
                  <tr
                    key={key}
                    className="border-b border-slate-100 dark:border-slate-800"
                  >
                    <td className="px-4 py-2 italic text-slate-600 dark:text-slate-400">
                      {label}
                    </td>
                    {columnKeys.map((column) => {
                      const calculated =
                        key === "effectiveGrossIncome"
                          ? calcEffectiveGrossIncome(financials, column)
                          : key === "noi"
                            ? calcNoi(financials, column)
                            : calcCashFlowAfterDebt(financials, column);

                      return (
                        <td key={column} className="px-3 py-2">
                          <CurrencyInput
                            shaded
                            italic
                            value={getDisplayCalculatedValue(
                              financials,
                              column,
                              calculated,
                              financials[overrideKey],
                            )}
                            onChange={(value) =>
                              patchYearTriple(overrideKey, column, value)
                            }
                          />
                        </td>
                      );
                    })}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          onClick={() => onChange(addFinancialYearColumn(financials))}
          className="mt-3 flex items-center gap-1 text-sm font-medium text-[#2C92D5] hover:underline"
        >
          <Plus className="h-4 w-4" />
          Add Year
        </button>

        <p className="mt-2 text-xs italic text-slate-500">
          Shaded rows are auto-calculated but can be overridden.
        </p>

        <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center">
          <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Months Reported (Interim Year)
          </label>
          <input
            type="number"
            min="0"
            max="12"
            value={financials.interimMonthsReported}
            onChange={(e) => patch({ interimMonthsReported: e.target.value })}
            placeholder="0"
            className="w-full rounded-md border border-slate-300 bg-white px-4 py-1 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 md:w-28"
          />
          <p className="text-xs text-slate-500">
            Used to annualize the interim NOI for DSCR.
          </p>
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Pro-Forma Projections
        </p>
        <p className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
          Pro-Forma NOI
        </p>

        <div className="max-w-sm space-y-2">
          {financials.proFormaNoiYears.map((year, index) => (
            <div key={year.id} className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-sm text-slate-600 dark:text-slate-400">
                Year {index + 1}
              </span>
              <div className="flex-1">
                <CurrencyInput
                  value={year.amount}
                  onChange={(value) =>
                    patch({
                      proFormaNoiYears: financials.proFormaNoiYears.map((entry) =>
                        entry.id === year.id ? { ...entry, amount: value } : entry,
                      ),
                    })
                  }
                />
              </div>
              {financials.proFormaNoiYears.length > 3 && (
                <button
                  type="button"
                  onClick={() =>
                    patch({
                      proFormaNoiYears: financials.proFormaNoiYears.filter(
                        (entry) => entry.id !== year.id,
                      ),
                    })
                  }
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-500 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={() =>
              patch({
                proFormaNoiYears: [
                  ...financials.proFormaNoiYears,
                  { id: Date.now(), amount: "" },
                ],
              })
            }
            className="flex items-center gap-1 text-sm font-medium text-[#2C92D5] hover:underline"
          >
            <Plus className="h-4 w-4" />
            Add Year
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-900/30">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          DSCR Calculation Method
        </p>

        <div className="space-y-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="radio"
              name="dscrCalculationMethod"
              checked={financials.dscrCalculationMethod === "noi"}
              onChange={() => patch({ dscrCalculationMethod: "noi" })}
              className="text-[#2C92D5]"
            />
            Use NOI
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="radio"
              name="dscrCalculationMethod"
              checked={financials.dscrCalculationMethod === "proForma"}
              onChange={() => patch({ dscrCalculationMethod: "proForma" })}
              className="text-[#2C92D5]"
            />
            Use Pro-Forma NOI
          </label>
        </div>

        <p className="mt-2 text-xs text-slate-500">
          DSCR uses the average of all entered pro-forma year amounts.
        </p>
      </div>

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Property Operating Expenses
        </p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Annual Property Taxes ($)
            </label>
            <CurrencyInput
              value={financials.annualPropertyTaxes}
              onChange={(value) => patch({ annualPropertyTaxes: value })}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Annual Insurance ($)
            </label>
            <CurrencyInput
              value={financials.annualInsurance}
              onChange={(value) => patch({ annualInsurance: value })}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
              HOA Dues ($) — optional
            </label>
            <CurrencyInput
              value={financials.hoaDues}
              onChange={(value) => patch({ hoaDues: value })}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-700">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              In Flood Zone?
            </span>
            <ToggleSwitch
              checked={financials.inFloodZone}
              onChange={(checked) => patch({ inFloodZone: checked })}
            />
          </div>
        </div>
      </div>

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Project Narrative
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Project Summary
            </label>
            <textarea
              value={financials.projectSummary}
              onChange={(e) => patch({ projectSummary: e.target.value })}
              rows={4}
              placeholder="Describe the project, property, and use of funds..."
              className="mt-1 w-full rounded-md border border-slate-300 px-4 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Exit Strategy
            </label>
            <textarea
              value={financials.exitStrategy}
              onChange={(e) => patch({ exitStrategy: e.target.value })}
              rows={4}
              placeholder="Describe how you plan to repay or refinance this loan..."
              className="mt-1 w-full rounded-md border border-slate-300 px-4 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
            />
          </div>
        </div>
      </div>
    </div>
  );
}


