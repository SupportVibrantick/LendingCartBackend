import { Check } from "lucide-react";
import { toggleAddOnCode } from "../lib/addOnCheckout";

/**
 * @param {{
 *   addOns: import('../types/pricing').SubscriptionAddOn[];
 *   selectedCodes: string[];
 *   onChange: (codes: string[]) => void;
 *   formatPrice: (value: number | string) => string;
 *   billingCycle?: 'MONTHLY' | 'YEARLY';
 *   compact?: boolean;
 * }} props
 */
export default function AddOnSelector({
  addOns,
  selectedCodes,
  onChange,
  formatPrice,
  billingCycle = "MONTHLY",
  compact = false,
}) {
  if (!addOns?.length) return null;

  const cycleSuffix = billingCycle === "YEARLY" ? "/yr" : "/mo";

  const handleToggle = (code) => {
    onChange(toggleAddOnCode(selectedCodes, code));
  };

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Optional add-ons
        </p>
        {!compact && (
          <p className="text-xs text-slate-500 mt-1">
            Extend your plan with product packs, extra seats, and integrations.
          </p>
        )}
      </div>

      <ul className="space-y-2">
        {addOns.map((addOn) => {
          const selected = selectedCodes.some(
            (code) => String(code).toUpperCase() === String(addOn.code).toUpperCase(),
          );
          const cycleAmount =
            billingCycle === "YEARLY"
              ? Number(addOn.priceMonthly) * 12
              : Number(addOn.priceMonthly);

          return (
            <li key={addOn.code}>
              <button
                type="button"
                onClick={() => handleToggle(addOn.code)}
                className={`w-full text-left rounded-xl border px-4 py-3 transition ${
                  selected
                    ? "border-indigo-400/50 bg-indigo-500/10"
                    : "border-white/10 bg-white/[0.03] hover:border-white/20"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                        selected
                          ? "border-indigo-400 bg-indigo-500 text-white"
                          : "border-white/20 bg-transparent"
                      }`}
                    >
                      {selected ? <Check size={12} /> : null}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">{addOn.name}</p>
                      {addOn.note && (
                        <p className="text-xs text-slate-500 mt-0.5">{addOn.note}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-indigo-300 whitespace-nowrap">
                    +{formatPrice(cycleAmount)}
                    {cycleSuffix}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
