import { SiteConfig } from "../../types/siteBuilder";

export default function SiteFooter({ config }: { config: SiteConfig }) {
  return (
    <div
      className="py-6 text-center text-sm text-white"
      style={{ backgroundColor: config.footer.bgColor }}
    >
      {config.footer.text}
    </div>
  );
}
