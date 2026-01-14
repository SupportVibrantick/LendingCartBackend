import { SiteConfig } from "../../types/siteBuilder";

export default function SiteNavbar({ config }: { config: SiteConfig }) {
  return (
    <div className="sticky top-0 z-50 backdrop-blur bg-white/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {config.branding.logoUrl ? (
            <img
              src={config.branding.logoUrl}
              alt="Logo"
              className="h-8 object-contain"
            />
          ) : (
            <div className="text-xl font-bold text-blue-600">
              {config.branding.brandName}
            </div>
          )}
        </div>

        <div className="hidden md:flex gap-8 font-medium">
          <button className="hover:text-blue-600">Home</button>
          <button className="hover:text-blue-600">About</button>
          <button className="hover:text-blue-600">Contact</button>
          <button className="hover:text-blue-600">Get a Loan</button>
        </div>
      </div>
    </div>
  );
}
