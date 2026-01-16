import { SiteConfig } from "../../../types/siteBuilder";

export default function WhyChooseUs({ config }: { config: SiteConfig }) {
  return (
    <div className="py-20 bg-[#F4F6F8] dark:bg-slate-900">
      <h2 className="text-2xl font-bold text-center mb-4">
        Why Choose Us?
      </h2>

      <p className="text-gray-600 dark:text-slate-400 font-light text-sm text-center mb-12">
        Choose plans that adapt to your business needs
      </p>

      <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8 px-6">
        {config.whyChooseUs.map((i, idx) => (
          <div
            key={idx}
            className="text-center p-8 rounded-xl bg-white dark:bg-slate-800 shadow hover:shadow-lg transition"
          >
            <h3 className="font-semibold text-md pb-2">
              {i.title}
            </h3>

            <p className="text-gray-600 dark:text-slate-400 font-light text-sm">
              {i.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
