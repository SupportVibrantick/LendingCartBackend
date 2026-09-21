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
        <Check className="text-emerald-400" size={18} strokeWidth={2.5} />
      </span>
    );
  }

  if (value === false || value == null) {
    return (
      <span className="text-gray-600 text-base leading-none" aria-label="Not included">
        —
      </span>
    );
  }

  return (
    <span className="text-sm text-gray-200 font-medium whitespace-nowrap">{value}</span>
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
      label: byCode.BASIC?.name || "Basic",
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
    <div id="plan-comparison" className="mt-20 max-w-5xl mx-auto text-left">
      <div className="text-center mb-10">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#4B83FF] mb-3">
          Full Comparison
        </p>
        <h3 className="text-3xl md:text-4xl font-bold text-white">
          Compare All <span className="text-[#4B83FF]">Plans</span>
        </h3>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02] shadow-[0_0_60px_rgba(75,131,255,0.06)]">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.03]">
              <th
                scope="col"
                className="py-4 px-4 md:px-6 text-left text-sm font-medium text-gray-400"
              >
                Feature
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className="py-4 px-3 md:px-4 text-center text-sm font-semibold text-[#4B83FF] whitespace-nowrap"
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
                className="border-b border-white/[0.06] last:border-b-0"
              >
                <th
                  scope="row"
                  className="py-3.5 px-4 md:px-6 text-left text-sm font-normal text-gray-200"
                >
                  {row.feature}
                </th>
                {columns.map((col) => (
                  <td key={col.key} className="py-3.5 px-3 md:px-4 text-center align-middle">
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
