import { Check } from "lucide-react";
import {
  getAddOnDisplayName,
  getAddOnQuantity,
  isQuantityAddOn,
  MAX_QUANTITY_ADDON,
  setAddOnQuantity,
  toggleAddOnCode,
} from "../lib/addOnCheckout";

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
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Optional add-ons
        </p>
        {!compact && (
          <p className="mt-1 text-xs text-slate-500">
            Extend your plan with product packs, extra seats, and integrations.
          </p>
        )}
      </div>

      <ul className="space-y-2">
        {addOns.map((addOn) => {
          const quantityBased = isQuantityAddOn(addOn);
          const quantity = getAddOnQuantity(selectedCodes, addOn.code);
          const selected = quantityBased
            ? quantity > 0
            : selectedCodes.some(
                (code) =>
                  String(code).toUpperCase() === String(addOn.code).toUpperCase(),
              );
          const unitCycleAmount =
            billingCycle === "YEARLY"
              ? Number(addOn.priceMonthly) * 12
              : Number(addOn.priceMonthly);
          const displayName = getAddOnDisplayName(addOn);

          if (quantityBased) {
            return (
              <li key={addOn.code}>
                <div
                  className={`flex w-full items-start justify-between gap-3 rounded-xl border px-4 py-3 transition ${
                    selected
                      ? "border-indigo-400/50 bg-indigo-500/10"
                      : "border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.03]"
                  }`}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-0.5 inline-flex shrink-0 items-center rounded-md border border-slate-200 bg-slate-50 p-0.5 dark:border-white/15 dark:bg-black/30">
                      <button
                        type="button"
                        aria-label="Decrease additional users"
                        disabled={quantity <= 0}
                        onClick={() =>
                          onChange(
                            setAddOnQuantity(
                              selectedCodes,
                              addOn.code,
                              quantity - 1,
                            ),
                          )
                        }
                        className="flex h-6 w-6 items-center justify-center rounded text-slate-700 hover:bg-slate-200 disabled:opacity-40 dark:text-white dark:hover:bg-white/10"
                      >
                        −
                      </button>
                      <span className="min-w-6 text-center text-xs font-semibold tabular-nums text-slate-900 dark:text-white">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        aria-label="Increase additional users"
                        disabled={quantity >= MAX_QUANTITY_ADDON}
                        onClick={() =>
                          onChange(
                            setAddOnQuantity(
                              selectedCodes,
                              addOn.code,
                              quantity + 1,
                            ),
                          )
                        }
                        className="flex h-6 w-6 items-center justify-center rounded text-slate-700 hover:bg-slate-200 disabled:opacity-40 dark:text-white dark:hover:bg-white/10"
                      >
                        +
                      </button>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {displayName}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {formatPrice(unitCycleAmount)}/user {cycleSuffix}
                      </p>
                    </div>
                  </div>
                  <span className="whitespace-nowrap text-sm font-semibold text-indigo-600 dark:text-indigo-300">
                    {selected
                      ? `+${formatPrice(unitCycleAmount * quantity)}${cycleSuffix}`
                      : `+${formatPrice(unitCycleAmount)}${cycleSuffix}`}
                  </span>
                </div>
              </li>
            );
          }

          return (
            <li key={addOn.code}>
              <button
                type="button"
                onClick={() => handleToggle(addOn.code)}
                className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                  selected
                    ? "border-indigo-400/50 bg-indigo-500/10"
                    : "border-slate-200 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                        selected
                          ? "border-indigo-400 bg-indigo-500 text-white"
                          : "border-slate-300 bg-transparent dark:border-white/20"
                      }`}
                    >
                      {selected ? <Check size={12} /> : null}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {displayName}
                      </p>
                      {addOn.note && (
                        <p className="mt-0.5 text-xs text-slate-500">{addOn.note}</p>
                      )}
                    </div>
                  </div>
                  <span className="whitespace-nowrap text-sm font-semibold text-indigo-600 dark:text-indigo-300">
                    +{formatPrice(unitCycleAmount)}
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
