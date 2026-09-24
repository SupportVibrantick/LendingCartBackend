import { Check } from "lucide-react";
import { PLAN_COMPARISON_ROWS } from "../data/planComparison";

/**
 * @param {number | string | null | undefined} value
 */
function formatPrice(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * @param {boolean | string} value
 */
function ComparisonCell({ value }) {
  if (value === true) {
    return (
      <span className="inline-flex items-center justify-center" aria-label="Included">
        <Check className="text-emerald-500 dark:text-emerald-400" size={18} strokeWidth={2.5} />
      </span>
    );
  }

  if (value === false || value == null) {
    return (
      <span
        className="text-base leading-none text-slate-400 dark:text-gray-600"
        aria-label="Not included"
      >
        —
      </span>
    );
  }

  return (
    <span className="whitespace-nowrap text-sm font-medium text-slate-700 dark:text-gray-200">
      {value}
    </span>
  );
}

/**
 * Full feature comparison table shown below pricing cards.
 * @param {{ packages?: import('../types/pricing').SubscriptionPackage[] }} props
 */
export default function PlanComparison({ packages = [] }) {
  const byCode = Object.fromEntries(
    (packages || []).map((pkg) => [String(pkg.code || "").toUpperCase(), pkg]),
  );

  const columns = [
    {
      key: "basic",
      code: "BASIC",
      label: byCode.BASIC?.name || "Starter",
      price: byCode.BASIC?.priceMonthly ?? 199,
    },
    {
      key: "pro",
      code: "PRO",
      label: byCode.PRO?.name || "Pro",
      price: byCode.PRO?.priceMonthly ?? 399,
    },
    {
      key: "elite",
      code: "ELITE",
      label: byCode.ELITE?.name || "Elite",
      price: byCode.ELITE?.priceMonthly ?? 699,
    },
  ];

  return (
    <div id="plan-comparison" className="mx-auto mt-20 max-w-5xl text-left">
      <div className="mb-10 text-center">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-[#4B83FF]">
          Full Comparison
        </p>
        <h3 className="text-3xl font-bold text-slate-900 md:text-4xl dark:text-white">
          Compare All <span className="text-[#4B83FF]">Plans</span>
        </h3>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.02] dark:shadow-[0_0_60px_rgba(75,131,255,0.06)]">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/[0.03]">
              <th
                scope="col"
                className="px-4 py-4 text-left text-sm font-medium text-slate-500 md:px-6 dark:text-gray-400"
              >
                Feature
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className="whitespace-nowrap px-3 py-4 text-center text-sm font-semibold text-[#4B83FF] md:px-4"
                >
                  {col.label} ({formatPrice(col.price)})
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PLAN_COMPARISON_ROWS.map((row) => (
              <tr
                key={row.feature}
                className="border-b border-slate-100 last:border-b-0 dark:border-white/[0.06]"
              >
                <th
                  scope="row"
                  className="px-4 py-3.5 text-left text-sm font-normal text-slate-700 md:px-6 dark:text-gray-200"
                >
                  {row.feature}
                </th>
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className="px-3 py-3.5 text-center align-middle md:px-4"
                  >
                    <ComparisonCell value={row[col.key]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
