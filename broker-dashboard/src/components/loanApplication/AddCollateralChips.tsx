import { useState, type KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";

type AddCollateralChipsProps = {
  items: string[];
  onChange: (items: string[]) => void;
};

/**
 * Free-form "Add Collateral" chip input. Lets the user list extra collateral
 * items not covered by the Business / Industry Type dropdown (e.g. intellectual
 * property, domain names, crypto assets).
 */
export default function AddCollateralChips({
  items,
  onChange,
}: AddCollateralChipsProps) {
  const [draft, setDraft] = useState("");

  const addChip = () => {
    const value = draft.trim();
    if (!value) return;
    if (items.includes(value)) {
      setDraft("");
      return;
    }
    onChange([...items, value]);
    setDraft("");
  };

  const removeChip = (value: string) => {
    onChange(items.filter((item) => item !== value));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addChip();
    } else if (
      e.key === "Backspace" &&
      draft === "" &&
      items.length > 0
    ) {
      // Convenience: empty backspace pops the last chip
      onChange(items.slice(0, -1));
    }
  };

  return (
    <div className="mt-5">
      <label className="text-sm font-semibold text-slate-800 dark:text-slate-100">
        Add Collateral
      </label>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
        Add any collateral not covered by the Collateral Type options above.
      </p>

      <div className="mt-2 flex items-stretch gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. Intellectual property, domain names, crypto assets..."
          className="flex-1 rounded-md border border-slate-300 px-4 py-1 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
        />
        <button
          type="button"
          onClick={addChip}
          className="inline-flex items-center gap-1.5 rounded-md border border-[#2C92D5] bg-[#2C92D5] px-4 text-sm font-medium text-white transition hover:bg-[#2579b3] focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!draft.trim()}
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>

      {items.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {items.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#2C92D5]/30 bg-blue-50 px-3 py-1 text-xs font-medium text-[#2C92D5] dark:border-[#2C92D5]/40 dark:bg-blue-900/30 dark:text-blue-200"
            >
              {item}
              <button
                type="button"
                onClick={() => removeChip(item)}
                className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[#2C92D5] hover:bg-[#2C92D5]/15 dark:text-blue-200 dark:hover:bg-blue-800/40"
                aria-label={`Remove ${item}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
