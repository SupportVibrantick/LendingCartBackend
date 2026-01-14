import { SiteConfig } from "../../../../types/siteBuilder";

export default function WhyChooseUsTab({
  config,
  setConfig,
}: {
  config: SiteConfig;
  setConfig: (c: SiteConfig) => void;
}) {
  const updateItem = (i: number, value: string) => {
    const items = [...config.whyChooseUs];
    items[i] = { title: value };
    setConfig({ ...config, whyChooseUs: items });
  };

  const addItem = () => {
    setConfig({
      ...config,
      whyChooseUs: [...config.whyChooseUs, { title: "New Reason" }],
    });
  };

  const removeItem = (i: number) => {
    const items = config.whyChooseUs.filter((_, idx) => idx !== i);
    setConfig({ ...config, whyChooseUs: items });
  };

  return (
    <div className="space-y-4">
      {config.whyChooseUs.map((item, i) => (
        <div
          key={i}
          className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl space-y-2"
        >
          <input
            className="w-full border rounded px-3 py-2 bg-white dark:bg-slate-900"
            value={item.title}
            onChange={(e) => updateItem(i, e.target.value)}
          />

          <button
            onClick={() => removeItem(i)}
            className="text-red-500 text-sm"
          >
            Remove
          </button>
        </div>
      ))}

      <button
        onClick={addItem}
        className="w-full py-2 border-2 border-dashed rounded text-sm"
      >
        + Add Reason
      </button>
    </div>
  );
}
