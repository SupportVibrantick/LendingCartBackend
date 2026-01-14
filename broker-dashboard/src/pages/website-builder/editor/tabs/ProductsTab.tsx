import { SiteConfig } from "../../../../types/siteBuilder";

export default function ProductsTab({
  config,
  setConfig,
}: {
  config: SiteConfig;
  setConfig: (c: SiteConfig) => void;
}) {
  const updateProduct = (i: number, key: "title" | "description", value: string) => {
    const items = [...config.products];
    items[i] = { ...items[i], [key]: value };
    setConfig({ ...config, products: items });
  };

  const addProduct = () => {
    setConfig({
      ...config,
      products: [...config.products, { title: "New Product", description: "Description" }],
    });
  };

  const removeProduct = (i: number) => {
    const items = config.products.filter((_, idx) => idx !== i);
    setConfig({ ...config, products: items });
  };

  return (
    <div className="space-y-4">
      {config.products.map((p, i) => (
        <div key={i} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl space-y-2">
          <input
            className="w-full border rounded px-3 py-2"
            value={p.title}
            onChange={(e) => updateProduct(i, "title", e.target.value)}
          />
          <input
            className="w-full border rounded px-3 py-2"
            value={p.description}
            onChange={(e) => updateProduct(i, "description", e.target.value)}
          />
          <button
            onClick={() => removeProduct(i)}
            className="text-red-500 text-sm"
          >
            Remove
          </button>
        </div>
      ))}

      <button
        onClick={addProduct}
        className="w-full py-2 border-2 border-dashed rounded text-sm"
      >
        + Add Product
      </button>
    </div>
  );
}
