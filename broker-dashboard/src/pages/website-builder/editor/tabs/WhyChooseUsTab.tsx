import { SiteConfig } from "../../../../types/siteBuilder";

export default function WhyChooseUsTab({
  config,
  setConfig,
}: {
  config: SiteConfig;
  setConfig: (c: SiteConfig) => void;
}) {
  const items = config.whyChooseUs;

  const updateItems = (newItems: typeof items) => {
    setConfig({ ...config, whyChooseUs: newItems });
  };

  return (
    <div className="space-y-4">

      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div className="font-semibold text-slate-800 dark:text-slate-200">
          Why Choose Us Cards
        </div>

        <button
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs"
          onClick={() =>
            updateItems([
              ...items,
              { title: "", description: "" },
            ])
          }
        >
          + Add Card
        </button>
      </div>

      {/* ITEMS */}
      {items.map((item, i) => (
        <div
          key={i}
          className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl space-y-3"
        >
          <div className="flex justify-between items-center">
            <div className="font-semibold text-sm text-slate-800 dark:text-slate-200">
              Card {i + 1}
            </div>

            <button
              onClick={() =>
                updateItems(items.filter((_, idx) => idx !== i))
              }
              className="text-red-600 hover:text-red-700 text-xs"
            >
              Remove
            </button>
          </div>

          {/* TITLE */}
          <input
            className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100"
            placeholder="Title"
            value={item.title}
            onChange={(e) => {
              const copy = [...items];
              copy[i] = { ...copy[i], title: e.target.value };
              updateItems(copy);
            }}
          />

          {/* DESCRIPTION */}
          <textarea
            className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100"
            placeholder="Description"
            rows={2}
            value={item.description}
            onChange={(e) => {
              const copy = [...items];
              copy[i] = { ...copy[i], description: e.target.value };
              updateItems(copy);
            }}
          />
        </div>
      ))}

    </div>
  );
}
