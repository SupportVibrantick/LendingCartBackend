import { SiteConfig } from "../../types/siteBuilder";

export default function SiteFooter({ config }: { config: SiteConfig }) {
  return (
    <div className="bg-slate-900 text-white py-6 text-center">
      © {new Date().getFullYear()} {config.branding.brandName}. All rights reserved.
    </div>
  );
}
