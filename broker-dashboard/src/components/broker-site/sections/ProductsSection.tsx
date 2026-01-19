import { SiteConfig } from "../../../types/siteBuilder";

export default function ProductsSection({ config }: { config: SiteConfig }) {
  return (
    <div className="py-20 bg-[#F8FAFC] dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-6">

        {/* HEADING */}
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-12 text-slate-900 dark:text-white">
          Our Loan Products
        </h2>

        {/* GRID */}
        <div className="grid md:grid-cols-3 gap-8">
          {config.products.map((p, i) => (
            <div
              key={i}
              className="p-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition"
            >
              {/* IMAGE */}
              <figure className="flex justify-center pb-4">
                <div className="h-28 w-28 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 border dark:border-slate-700 p-4">
                  <img
                    src={
                      p.imageUrl ||
                      "https://cdn-icons-png.freepik.com/256/17222/17222841.png"
                    }
                    className="h-full w-full object-contain"
                  />
                </div>
              </figure>

              {/* TITLE */}
              <h3 className="text-lg font-semibold text-center text-slate-900 dark:text-white">
                {p.title || "Product Title"}
              </h3>

              {/* DESCRIPTION */}
              <p className="text-sm mt-2 text-slate-600 dark:text-slate-400 text-center leading-relaxed">
                {p.description || "Product Description"}
              </p>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
