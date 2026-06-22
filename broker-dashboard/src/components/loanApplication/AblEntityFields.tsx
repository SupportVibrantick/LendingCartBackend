import {
  FINANCIAL_YEAR_COLUMNS,
  formatCurrencyInput,
  getFinancialYearColumns,
  type FinancialYearColumn,
  type ResidentialFinancials,
} from "../../lib/residentialFinancials";

type AblEntityFieldsProps = {
  ebitdaWithNoi: string;
  financials: ResidentialFinancials;
  onEbitdaChange: (value: string) => void;
  onFinancialsChange: (financials: ResidentialFinancials) => void;
  formatCurrency: (value: string) => string;
};

const CurrencyInput = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) => (
  <div className="relative">
    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
      $
    </span>
    <input
      type="text"
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(formatCurrencyInput(e.target.value))}
      placeholder="0"
      className="w-full rounded-md border border-slate-300 py-1 pl-7 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
    />
  </div>
);

export default function AblEntityFields({
  ebitdaWithNoi,
  financials,
  onEbitdaChange,
  onFinancialsChange,
  formatCurrency,
}: AblEntityFieldsProps) {
  const yearColumns = getFinancialYearColumns();

  const patchYearValue = (
    key: "grossRevenue" | "noiOverride",
    column: FinancialYearColumn,
    value: string,
  ) => {
    onFinancialsChange({
      ...financials,
      [key]: {
        ...financials[key],
        [column]: value,
      },
    });
  };

  return (
    <>
      <p className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wide text-slate-500">
        EBITDA / NOI
      </p>

      <div className="max-w-md">
        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
          EBITDA with NOI ($)
        </label>
        <div className="relative mt-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
            $
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={ebitdaWithNoi}
            onChange={(e) => onEbitdaChange(formatCurrency(e.target.value))}
            placeholder="0"
            className="w-full rounded-md border border-slate-300 py-1 pl-7 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
          />
        </div>
      </div>

      <p className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Annual Financials
      </p>

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50">
              <th className="px-4 py-2 text-left font-medium text-slate-600 dark:text-slate-300">
                &nbsp;
              </th>
              {yearColumns.map(({ label }) => (
                <th
                  key={label}
                  className="px-4 py-2 text-left font-medium text-slate-600 dark:text-slate-300"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <td className="px-4 py-2 font-medium text-slate-700 dark:text-slate-200">
                Annual Gross Revenue
              </td>
              {FINANCIAL_YEAR_COLUMNS.map((column) => (
                <td key={column} className="px-4 py-2">
                  <CurrencyInput
                    value={financials.grossRevenue[column]}
                    onChange={(value) => patchYearValue("grossRevenue", column, value)}
                  />
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-4 py-2 font-medium text-slate-700 dark:text-slate-200">
                Annual Net Income
              </td>
              {FINANCIAL_YEAR_COLUMNS.map((column) => (
                <td key={column} className="px-4 py-2">
                  <CurrencyInput
                    value={financials.noiOverride[column]}
                    onChange={(value) => patchYearValue("noiOverride", column, value)}
                  />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
