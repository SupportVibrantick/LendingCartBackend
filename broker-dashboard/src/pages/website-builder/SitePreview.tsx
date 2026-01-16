import { SiteConfig } from "../../types/siteBuilder";
import SiteLayout from "../../components/broker-site/SiteLayout";

export default function SitePreview({ config }: { config: SiteConfig }) {
  return (
    <div className="bg-white rounded-xl shadow overflow-hidden">
      <SiteLayout config={config} />
    </div>
  );
}
