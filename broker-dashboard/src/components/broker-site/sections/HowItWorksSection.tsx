import { SiteConfig } from "../../../types/siteBuilder";
// import {
//   FileText,
//   Users,
//   Home,
//   CheckCircle,
//   Zap,
//   CreditCard,
//   Search,
//   Send,
// } from "lucide-react";

/* ICON MAP */
// const ICONS: Record<string, any> = {
//   file: FileText,
//   users: Users,
//   home: Home,
//   check: CheckCircle,
//   zap: Zap,
//   card: CreditCard,
//   search: Search,
//   send: Send,
// };

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
    <div className="py-20 bg-white text-center">
      <h2 className="text-2xl font-bold mb-12 text-slate-900">
        {title}
      </h2>

      <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-10 px-6">
        {steps.map((s, i) => {
          //   const IconComp = ICONS[s.icon] || FileText;

          return (
            <div key={i} className="flex flex-col items-center gap-4">
              {/* ICON */}
              {s.iconUrl && (
                <div className="flex justify-center">
                  <div
                    className="h-24 w-24 rounded-full flex items-center justify-center shadow mb-3 bg-white"
                    // style={{ border: "1px solid #eee" }}
                  >
                    <img src={s.iconUrl} className="h-24 w-24 object-contain" />
                  </div>
                </div>
              )}

              {/* STEP NUMBER */}
              <div
                className="h-6 w-6 rounded-full text-white flex items-center justify-center text-sm font-bold"
                style={{ backgroundColor: config.branding.primaryColor }}
              >
                {i + 1}
              </div>

              {/* TITLE */}
              <div className="font-semibold text-md">{s.title}</div>

              {/* DESC */}
              <div className="text-sm text-slate-500 text-center">
                {s.description}
              </div>
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <div className="mt-12">
        <button
          className="text-white px-8 py-3 rounded-full font-semibold text-xs"
          style={{ backgroundColor: config.branding.primaryColor }}
          onClick={() => onNavigate("get-loan")}
        >
          {ctaText} →
        </button>
      </div>
    </div>
  );
}
