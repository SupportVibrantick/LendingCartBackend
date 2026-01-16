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
        <div className="font-semibold">Why Choose Us Cards</div>

        <button
          className="bg-blue-600 text-white px-3 py-2 rounded-lg text-xs"
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
          className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl space-y-3 border"
        >
          <div className="flex justify-between items-center">
            <div className="font-semibold text-sm">
              Card {i + 1}
            </div>

            <button
              onClick={() =>
                updateItems(items.filter((_, idx) => idx !== i))
              }
              className="text-red-600 text-xs"
            >
              Remove
            </button>
          </div>

          {/* TITLE */}
          <input
            className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-900 text-sm text-gray-800"
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
            className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-900 text-sm text-gray-800"
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
