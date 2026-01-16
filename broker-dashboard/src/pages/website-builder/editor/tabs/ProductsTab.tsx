import { SiteConfig } from "../../../../types/siteBuilder";

export default function ProductsTab({
  config,
  setConfig,
}: {
  config: SiteConfig;
  setConfig: (c: SiteConfig) => void;
}) {
  const products = config.products;

  const updateProducts = (newProducts: typeof products) => {
    setConfig({ ...config, products: newProducts });
  };

  const uploadImage = (file: File | undefined, cb: (url: string) => void) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => cb(r.result as string);
    r.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">

      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div className="font-semibold">Loan Products</div>

        <button
          className="bg-blue-600 text-white px-3 py-2 rounded-lg text-xs"
          onClick={() =>
            updateProducts([
              ...products,
              { title: "", description: "", imageUrl: "" },
            ])
          }
        >
          + Add Product
        </button>
      </div>

      {/* PRODUCT LIST */}
      {products.map((p, i) => (
        <div
          key={i}
          className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl space-y-3 border"
        >
          <div className="flex justify-between items-center">
            <div className="font-semibold text-sm">Product {i + 1}</div>

            <button
              className="text-red-600 text-xs"
              onClick={() =>
                updateProducts(products.filter((_, idx) => idx !== i))
              }
            >
              Remove
            </button>
          </div>

          {/* IMAGE */}
          <div className="flex items-center gap-4">
            {p.imageUrl ? (
              <img
                src={p.imageUrl}
                className="h-16 w-16 object-contain border rounded bg-white p-2"
              />
            ) : (
              <div className="h-16 w-16 flex items-center justify-center border rounded text-xs text-slate-400 bg-white">
                No Image
              </div>
            )}

            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) =>
                  uploadImage(e.target.files?.[0], (url) => {
                    const copy = [...products];
                    copy[i] = { ...copy[i], imageUrl: url };
                    updateProducts(copy);
                  })
                }
              />
              <div className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs">
                Upload Image
              </div>
            </label>
          </div>

          {/* TITLE */}
          <input
            value={p.title}
            onChange={(e) => {
              const copy = [...products];
              copy[i] = { ...copy[i], title: e.target.value };
              updateProducts(copy);
            }}
            className="text-gray-800 w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-900 text-sm"
            placeholder="Product Title"
          />

          {/* DESCRIPTION */}
          <textarea
            value={p.description}
            onChange={(e) => {
              const copy = [...products];
              copy[i] = { ...copy[i], description: e.target.value };
              updateProducts(copy);
            }}
            className="text-gray-800 w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-900 text-sm"
            placeholder="Product Description"
            rows={2}
          />
        </div>
      ))}
    </div>
  );
}
