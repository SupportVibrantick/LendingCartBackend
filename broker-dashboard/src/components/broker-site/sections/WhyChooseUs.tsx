import { SiteConfig } from "../../../types/siteBuilder";

export default function WhyChooseUs({ config }: { config: SiteConfig }) {
  return (
    <div className="py-20">
      <h2 className="text-3xl font-bold text-center mb-12">
        Why Choose Us?
      </h2>

      <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8 px-6">
        {config.whyChooseUs.map((i, idx) => (
          <div
            key={idx}
            className="text-center p-6 rounded-xl bg-white dark:bg-slate-800 shadow"
          >
            <div className="text-4xl mb-4">✅</div>
            <h3 className="font-semibold text-lg">{i.title}</h3>
          </div>
        ))}
      </div>
    </div>
  );
}
