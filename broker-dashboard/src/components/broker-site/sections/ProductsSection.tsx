import { SiteConfig } from "../../../types/siteBuilder";

export default function ProductsSection({ config }: { config: SiteConfig }) {
  return (
    <div className="py-20 bg-slate-50 dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-2xl font-bold text-center mb-12">
          Our Loan Products
        </h2>

        <div className="grid md:grid-cols-3 gap-8">
          {config.products.map((p, i) => (
            <div
              key={i}
              className="p-8 rounded-2xl text-white shadow-xl"
              style={{
                background:
                  i === 0
                    ? "linear-gradient(135deg,#2563eb,#1e40af)"
                    : i === 1
                    ? "linear-gradient(135deg,#0f172a,#334155)"
                    : "linear-gradient(135deg,#4f46e5,#7c3aed)",
              }}
            >
              <h3 className="text-lg font-semibold">{p.title}</h3>
              <p className="text-sm mt-2 opacity-90">{p.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
