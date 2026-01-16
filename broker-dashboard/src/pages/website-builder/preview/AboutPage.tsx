import { SiteConfig } from "../../../types/siteBuilder";

export default function AboutPage({ config }: { config: SiteConfig }) {
  const about = config.about;

  return (
    <div className="bg-white dark:bg-slate-900">
      {/* HERO */}
      <div className="max-w-7xl mx-auto px-8 py-16 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <h1
            className="text-4xl font-bold dark:text-white"
            style={{ color: config.about.headingColor }}
          >
            {about.heroTitle}
          </h1>
        </div>

        <img
          src={
            about.heroImageUrl ||
            "https://lirp.cdn-website.com/3d34d6e7/dms3rep/multi/opt/KV-about-480w.jpg"
          }
          className="rounded-2xl shadow-xl"
        />
      </div>

      {/* ABOUT */}
      <div className="bg-slate-50 dark:bg-slate-800 py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          {/* Small badge */}
          <div
            className="inline-block px-4 py-1 rounded-full text-sm font-semibold mb-4"
            style={{
              backgroundColor: config.about.headingColor + "20",
              color: config.about.headingColor,
            }}
          >
            About Us
          </div>

          {/* Main Heading */}
          <h2
            className="text-3xl font-extrabold mb-6 leading-tight"
            style={{ color: config.about.headingColor }}
          >
            About{" "}
            <span className="relative inline-block" style={{color: config.branding.logoColor}}>
              {config.branding.brandName}
              <span
                className="absolute left-0 -bottom-2 w-full h-2 rounded-full opacity-30"
                style={{ backgroundColor: config.about.headingColor }}
              />
            </span>
          </h2>

          {/* Description */}
          <p className="text-center text-slate-600 dark:text-slate-300 text-md leading-relaxed max-w-3xl mx-auto">
            {about.description}
          </p>
        </div>
      </div>

      {/* TEAM */}
      <div className="bg-slate-50 dark:bg-slate-800 py-16">
        <h2
          className="text-3xl font-bold text-center mb-4"
          style={{ color: config.about.headingColor }}
        >
          Our Team
        </h2>
        <p className="text-center text-slate-500 mb-10 text-md">
          Meet our amazing professionals
        </p>

        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 px-6">
          {about.team.map((m, i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-900 p-4 rounded-xl text-center shadow"
            >
              <img
                src={
                  m.imageUrl ||
                  "https://lirp.cdn-website.com/3d34d6e7/dms3rep/multi/opt/placeholder-1920w.jpg"
                }
                className="h-32 w-32 mx-auto rounded-full object-cover"
              />
              <div className="mt-4 text-sm font-semibold">{m.name}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
