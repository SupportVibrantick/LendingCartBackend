import { SiteConfig } from "../../../types/siteBuilder";

export default function HeroSection({ config }: { config: SiteConfig }) {
  return (
    <div
      className="relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${config.branding.primaryColor}, #1e293b)`,
      }}
    >
      <div className="max-w-7xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center text-white">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight">
            {config.home.heroHeading}
          </h1>
          <p className="mt-4 text-lg opacity-90">
            {config.home.heroSubheading}
          </p>

          <button className="mt-8 bg-white text-black px-6 py-3 rounded-xl font-semibold shadow-lg hover:scale-105 transition">
            {config.home.ctaText}
          </button>
        </div>

        <div className="hidden md:block">
          {config.home.heroImageUrl ? (
            <img
              className="rounded-3xl shadow-2xl"
              src={config.home.heroImageUrl}
              alt="Hero"
            />
          ) : (
            <img
              className="rounded-3xl shadow-2xl"
              src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=1200"
              alt="Default"
            />
          )}
        </div>
      </div>
    </div>
  );
}
