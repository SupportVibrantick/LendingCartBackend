import { SiteConfig } from "../../../types/siteBuilder";
import { MapPin, Facebook, Globe, Instagram, ArrowRight } from "lucide-react";

export default function HeroSection({ config }: { config: SiteConfig }) {
  const heroHeading = config?.home?.heroHeading || "Get Your Loan Fast & Easy";
  const heroSubheading =
    config?.home?.heroSubheading || "Home Loans, Business Loans & More";
  const ctaText = config?.home?.ctaText || "Apply Now";
  const bgImage =
    config?.home?.heroImageUrl ||
    "https://lirp.cdn-website.com/3d34d6e7/dms3rep/multi/opt/hero-image-698w.png";

  const primary = config.branding.primaryColor;

  return (
    <div className="relative h-[100vh] min-h-[600px] w-full overflow-hidden bg-black flex items-center">
      {/* Background */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: `url('${bgImage}')` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/20"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 w-full text-white">
        <div className="grid lg:grid-cols-12 gap-8 items-center">
          {/* Left Content */}
          <div className="lg:col-span-9 xl:col-span-8 space-y-6 md:space-y-8">
            {/* Accent */}
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-[3px]"
                style={{ backgroundColor: primary }}
              ></div>
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-400">
                Brokerage Excellence
              </span>
            </div>

            {/* Heading */}
            <div className="space-y-6">
              <h1 className="text-[clamp(2.5rem,8vw,5rem)] font-black uppercase leading-[0.95] tracking-tighter max-w-4xl line-clamp-3">
                {heroHeading.split(" ").map((word, i) => (
                  <span
                    key={i}
                    style={i === 1 ? { color: primary } : undefined}
                  >
                    {word}{" "}
                  </span>
                ))}
              </h1>

              <p className="max-w-xl text-base md:text-lg text-gray-300 leading-relaxed font-light line-clamp-2">
                {heroSubheading}
              </p>
            </div>

            {/* Location */}
            <div className="flex items-center gap-3 py-2">
              <div className="p-2 bg-white/10 rounded-lg backdrop-blur-md">
                <MapPin size={16} style={{ color: primary }} />
              </div>
              <span className="text-xs md:text-sm font-bold tracking-widest uppercase text-gray-200">
                {config.contact.address}
              </span>
            </div>

            {/* CTA */}
            <div className="flex flex-wrap items-center gap-6 pt-8">
              <button
                className="group relative overflow-hidden border-2 px-10 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300"
                style={{
                  borderColor: primary,
                  color: primary,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = primary;
                  e.currentTarget.style.color = "#000";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = primary;
                }}
              >
                <span className="relative z-10 flex items-center gap-2">
                  {ctaText}
                  <ArrowRight
                    size={14}
                    className="group-hover:translate-x-1 transition-transform"
                  />
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Socials */}
        <div className="absolute bottom-[62px] left-6 flex flex-col md:flex-row md:items-center gap-8">
          <div className="flex items-center gap-6">
            {[Facebook, Globe, Instagram].map((Icon, i) => (
              <Icon
                key={i}
                size={18}
                className="cursor-pointer transition-all"
                style={{ color: primary }}
              />
            ))}
          </div>

          <div className="hidden md:block h-[1px] w-24 bg-white/20"></div>
        </div>
      </div>

      {/* Side Progress */}
      <div className="absolute right-10 top-1/2 -translate-y-1/2 hidden xl:flex flex-col gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="w-1 h-8 rounded-full"
            style={{
              backgroundColor: i === 1 ? primary : "rgba(255,255,255,0.15)",
            }}
          ></div>
        ))}
      </div>
    </div>
  );
}
