import { SiteConfig } from "../../../types/siteBuilder";

export default function ProductsSection({ config }: { config: SiteConfig }) {
  return (
    <div className="py-20 bg-[#F8FAFC] dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-2xl font-bold text-center mb-12">
          Our Loan Products
        </h2>

        <div className="grid md:grid-cols-3 gap-8">
          {config.products.map((p, i) => (
            <div key={i} className="p-8 rounded-md">
              <figure className="flex justify-center pb-4">
                <img
                  src={
                    p.imageUrl ||
                    "https://cdn-icons-png.freepik.com/256/17222/17222841.png"
                  }
                  className="h-28 w-28 bg-[#EBEAEB] border rounded-full p-4 object-contain"
                />
              </figure>
              <h3 className="text-lg font-semibold text-center">{p.title || "Product Title"}</h3>
              <p className="text-sm font-light mt-2 opacity-90 text-center">
                {p.description || "Product Description"}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
