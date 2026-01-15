import { SiteConfig } from "../../types/siteBuilder";

export default function SiteNavbar({
  config,
  onNavigate,
  activePage,
}: {
  config: SiteConfig;
  onNavigate: (page: "home" | "about" | "get-loan" | "contact") => void;
  activePage: "home" | "about" | "get-loan" | "contact";
}) {
  const linkClass = (page: "home" | "about" | "get-loan" | "contact") =>
    `cursor-pointer px-3 py-2 font-medium transition text-sm ${
      activePage === page
        ? "text-blue-600 border-b-2 border-blue-600"
        : "text-slate-600 hover:text-blue-600"
    }`;

  return (
    <div className="bg-white dark:bg-slate-900 border-b px-8 py-4 flex items-center justify-between">
      {/* LOGO AREA */}
      <div className="flex items-center gap-3">

        {config.branding.logoUrl ? (
          <img
            src={config.branding.logoUrl}
            alt="Logo"
            className="h-10 object-contain"
          />
        ) : (
          <div
            className="font-bold text-md"
            style={{ color: config.branding.logoColor }}
          >
            {config.branding.brandName}
          </div>
        )}
      </div>

      {/* NAV LINKS */}
      <div className="flex gap-6">
        <div className={linkClass("home")} onClick={() => onNavigate("home")}>
          Home
        </div>

        <div className={linkClass("about")} onClick={() => onNavigate("about")}>
          About
        </div>

        <div
          className={linkClass("get-loan")}
          onClick={() => onNavigate("get-loan")}
        >
          Get a Loan
        </div>

        <div
          className={linkClass("contact")}
          onClick={() => onNavigate("contact")}
        >
          Contact
        </div>
      </div>
    </div>
  );
}
