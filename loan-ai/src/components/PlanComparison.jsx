import { Check, Sparkles, X } from "lucide-react";
import { PLAN_COMPARISON_ROWS } from "../data/planComparison";

/**
 * @param {number | string | null | undefined} value
 */
function formatPrice(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return "";
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
      <span
        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20 dark:bg-emerald-400/10 dark:ring-emerald-400/25"
        aria-label="Included"
      >
        <Check
          className="text-emerald-600 dark:text-emerald-400"
          size={16}
          strokeWidth={2.75}
        />
      </span>
    );
  }

  if (value === false || value == null) {
    return (
      <span
        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 ring-1 ring-slate-200 dark:bg-white/[0.04] dark:ring-white/10"
        aria-label="Not included"
      >
        <X
          className="text-slate-300 dark:text-slate-600"
          size={14}
          strokeWidth={2.25}
        />
      </span>
    );
  }

  return (
    <span className="inline-flex max-w-[11rem] items-center justify-center rounded-full bg-[#4B83FF]/10 px-2.5 py-1 text-xs font-semibold text-[#4B83FF] ring-1 ring-[#4B83FF]/15 dark:bg-[#4B83FF]/15 dark:text-[#9CBCFF] dark:ring-[#4B83FF]/25">
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
      price: byCode.BASIC?.priceMonthly ?? 249,
      accent: "border-slate-200 dark:border-white/10",
    },
    {
      key: "pro",
      code: "PRO",
      label: byCode.PRO?.name || "Pro",
      price: byCode.PRO?.priceMonthly ?? 499,
      highlight: true,
      accent: "border-[#4B83FF]/35 dark:border-[#4B83FF]/40",
    },
    {
      key: "elite",
      code: "ELITE",
      label: byCode.ELITE?.name || "Elite",
      price: byCode.ELITE?.priceMonthly ?? 874,
      accent: "border-slate-200 dark:border-white/10",
    },
  ];

  return (
    <div id="plan-comparison" className="relative mx-auto mt-20 max-w-6xl text-left">
      <div className="pointer-events-none absolute inset-x-0 -top-10 h-40 bg-[radial-gradient(ellipse_at_50%_0%,rgba(75,131,255,0.12)_0%,transparent_70%)] dark:bg-[radial-gradient(ellipse_at_50%_0%,rgba(75,131,255,0.18)_0%,transparent_70%)]" />

      <div className="relative mb-10 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#4B83FF]/25 bg-[#4B83FF]/10 px-3.5 py-1.5">
          <Sparkles size={12} className="text-[#4B83FF]" aria-hidden />
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#4B83FF]">
            Full Comparison
          </p>
        </div>
        <h3 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl dark:text-white">
          Compare All <span className="text-[#4B83FF]">Plans</span>
        </h3>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          Side-by-side view of what you get on Starter, Pro, and Elite — including
          GHL add-ons and growth tools.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white shadow-[0_24px_60px_-36px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-[#0f172a] dark:shadow-[0_0_60px_rgba(75,131,255,0.08)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90 dark:border-white/10 dark:bg-white/[0.03]">
                <th
                  scope="col"
                  className="sticky left-0 z-20 bg-slate-50/95 px-4 py-5 text-left text-sm font-semibold text-slate-500 backdrop-blur md:px-6 dark:bg-[#0f172a]/95 dark:text-slate-400"
                >
                  Feature
                </th>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className="px-3 py-5 text-center md:px-4"
                  >
                    <div
                      className={`mx-auto inline-flex min-w-[8.5rem] flex-col items-center rounded-2xl border bg-white px-3 py-3 shadow-sm dark:bg-white/[0.04] ${col.accent} ${
                        col.highlight
                          ? "ring-2 ring-[#4B83FF]/20 dark:ring-[#4B83FF]/30"
                          : ""
                      }`}
                    >
                      {col.highlight ? (
                        <span className="mb-1.5 rounded-full bg-[#4B83FF] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                          Popular
                        </span>
                      ) : (
                        <span className="mb-1.5 h-[18px]" aria-hidden />
                      )}
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">
                        {col.label}
                      </span>
                      <span className="mt-1 text-xs font-semibold text-[#4B83FF]">
                        {formatPrice(col.price)}
                        <span className="font-medium text-slate-400 dark:text-slate-500">
                          /mo
                        </span>
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PLAN_COMPARISON_ROWS.map((row, index) => {
                const isSection =
                  row.feature === "GHL STARTER" || row.feature === "GHL GROWTH";
                return (
                  <tr
                    key={row.feature}
                    className={`border-b border-slate-100 last:border-b-0 dark:border-white/[0.06] ${
                      isSection
                        ? "bg-[#4B83FF]/[0.06] dark:bg-[#4B83FF]/10"
                        : index % 2 === 1
                          ? "bg-slate-50/80 dark:bg-white/[0.025]"
                          : "bg-white dark:bg-transparent"
                    }`}
                  >
                    <th
                      scope="row"
                      className={`sticky left-0 z-10 px-4 py-3.5 text-left text-sm backdrop-blur md:px-6 ${
                        isSection
                          ? "bg-[#EAF1FF] font-semibold uppercase tracking-[0.08em] text-[#4B83FF] dark:bg-[#13233f] dark:text-[#9CBCFF]"
                          : index % 2 === 1
                            ? "bg-slate-50/95 font-medium text-slate-700 dark:bg-[#111827]/95 dark:text-slate-200"
                            : "bg-white/95 font-medium text-slate-700 dark:bg-[#0f172a]/95 dark:text-slate-200"
                      }`}
                    >
                      {row.feature}
                    </th>
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className="px-3 py-3.5 text-center align-middle md:px-4"
                      >
                        <div className="flex justify-center">
                          <ComparisonCell value={row[col.key]} />
                        </div>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
