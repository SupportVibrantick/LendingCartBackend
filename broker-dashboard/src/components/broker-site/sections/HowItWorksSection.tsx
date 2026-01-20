import { SiteConfig } from "../../../types/siteBuilder";

export default function HowItWorksSection({
  config,
  onNavigate,
}: {
  config: SiteConfig;
  onNavigate: (page: "home" | "about" | "get-loan" | "contact") => void;
}) {
  if (!config.howItWorks.enabled) return null;

  const { title, steps, ctaText } = config.howItWorks;

  return (
    <div className="py-20 bg-white dark:bg-slate-950 text-center">
      {/* TITLE */}
      <h2 className="text-2xl md:text-3xl font-bold mb-12 text-slate-900 dark:text-white">
        {title}
      </h2>

      {/* STEPS GRID */}
      <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-10 px-6">
        {steps.map((s, i) => {
          return (
            <div
              key={i}
              className="flex flex-col items-center gap-4 p-6 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition"
            >
              {/* ICON */}
              {s.iconUrl && (
                <div className="flex justify-center">
                  <div className="h-24 w-24 rounded-full flex items-center justify-center bg-white dark:bg-slate-800 border dark:border-slate-700 shadow-sm mb-2">
                    <img
                      src={s.iconUrl}
                      className="h-16 w-16 object-contain"
                      alt="Step Icon"
                    />
                  </div>
                </div>
              )}

              {/* STEP NUMBER */}
              <div
                className="h-7 w-7 rounded-full text-white flex items-center justify-center text-xs font-bold"
                style={{ backgroundColor: config.branding.primaryColor }}
              >
                {i + 1}
              </div>

              {/* TITLE */}
              <div className="font-semibold text-md text-slate-900 dark:text-white text-center">
                {s.title}
              </div>

              {/* DESC */}
              <div className="text-sm text-slate-600 dark:text-slate-400 text-center leading-relaxed">
                {s.description}
              </div>
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <div className="mt-14">
        <button
          className="text-white px-10 py-3.5 rounded-full font-semibold text-sm shadow hover:opacity-90 transition"
          style={{ backgroundColor: config.branding.primaryColor }}
          onClick={() => onNavigate("get-loan")}
        >
          {ctaText} →
        </button>
      </div>
    </div>
  );
}
