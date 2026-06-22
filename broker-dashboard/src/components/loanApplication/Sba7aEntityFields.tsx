import {
  FINANCIAL_YEAR_COLUMNS,
  formatCurrencyInput,
  getFinancialYearColumns,
  type FinancialYearColumn,
  type ResidentialFinancials,
} from "../../lib/residentialFinancials";
import type { SbaEntityFields } from "../../lib/sba7aAcquisition";

type Sba7aEntityFieldsProps = {
  entity: SbaEntityFields & { ebitdaWithNoi: string };
  financials: ResidentialFinancials;
  onEntityChange: (field: keyof SbaEntityFields | "ebitdaWithNoi", value: string | boolean) => void;
  onFinancialsChange: (financials: ResidentialFinancials) => void;
  errors: Record<string, string>;
  formatCurrency: (value: string) => string;
};

const ToggleSwitch = ({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition ${
      checked ? "bg-[#2C92D5]" : "bg-slate-200 dark:bg-slate-700"
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

export default function Sba7aEntityFields({
  entity,
  financials,
  onEntityChange,
  onFinancialsChange,
  errors,
  formatCurrency,
}: Sba7aEntityFieldsProps) {
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
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Industry Code (NAICS)
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={entity.naicsCode}
            onChange={(e) =>
              onEntityChange("naicsCode", e.target.value.replace(/\D/g, ""))
            }
            placeholder="e.g. 522110"
            className="mt-1 w-full rounded-md border border-slate-300 px-4 py-1 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Goodwill Amount ($)
          </label>
          <div className="relative mt-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
              $
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={entity.goodwillAmount}
              onChange={(e) =>
                onEntityChange("goodwillAmount", formatCurrency(e.target.value))
              }
              placeholder="0"
              className="w-full rounded-md border border-slate-300 py-1 pl-7 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
            />
          </div>
        </div>

        <div
          className={
            entity.inventoryIncluded
              ? "flex items-center justify-between rounded-md border border-slate-200 px-4 py-3 dark:border-slate-700"
              : "md:col-span-2 flex items-center justify-between rounded-md border border-slate-200 px-4 py-3 dark:border-slate-700"
          }
        >
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Inventory Included?
          </span>
          <ToggleSwitch
            checked={entity.inventoryIncluded}
            onChange={(checked) => {
              onEntityChange("inventoryIncluded", checked);
              if (!checked) onEntityChange("inventoryValue", "");
            }}
          />
        </div>

        {entity.inventoryIncluded && (
          <div>
            <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Inventory Value ($)
            </label>
            <div className="relative mt-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                $
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={entity.inventoryValue}
                onChange={(e) =>
                  onEntityChange(
                    "inventoryValue",
                    formatCurrency(e.target.value),
                  )
                }
                placeholder="0"
                className="w-full rounded-md border border-slate-300 py-1 pl-7 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
              />
            </div>
            {errors["entity.inventoryValue"] && (
              <p className="mt-1 text-xs text-red-500">
                {errors["entity.inventoryValue"]}
              </p>
            )}
          </div>
        )}

        <div
          className={
            entity.equipmentIncluded
              ? "flex items-center justify-between rounded-md border border-slate-200 px-4 py-3 dark:border-slate-700"
              : "md:col-span-2 flex items-center justify-between rounded-md border border-slate-200 px-4 py-3 dark:border-slate-700"
          }
        >
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Equipment Included?
          </span>
          <ToggleSwitch
            checked={entity.equipmentIncluded}
            onChange={(checked) => {
              onEntityChange("equipmentIncluded", checked);
              if (!checked) onEntityChange("equipmentValue", "");
            }}
          />
        </div>

        {entity.equipmentIncluded && (
          <div>
            <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Equipment Value ($)
            </label>
            <div className="relative mt-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                $
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={entity.equipmentValue}
                onChange={(e) =>
                  onEntityChange(
                    "equipmentValue",
                    formatCurrency(e.target.value),
                  )
                }
                placeholder="0"
                className="w-full rounded-md border border-slate-300 py-1 pl-7 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
              />
            </div>
            {errors["entity.equipmentValue"] && (
              <p className="mt-1 text-xs text-red-500">
                {errors["entity.equipmentValue"]}
              </p>
            )}
          </div>
        )}
      </div>

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
            value={entity.ebitdaWithNoi}
            onChange={(e) =>
              onEntityChange("ebitdaWithNoi", formatCurrency(e.target.value))
            }
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

      {errors["entity.naicsCode"] && (
        <p className="mt-1 text-xs text-red-500">{errors["entity.naicsCode"]}</p>
      )}
    </>
  );
}
