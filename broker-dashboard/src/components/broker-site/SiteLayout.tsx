import { SiteConfig } from "../../types/siteBuilder";
import SiteNavbar from "./SiteNavbar";
import SiteFooter from "./SiteFooter";
import HeroSection from "./sections/HeroSection";
import ProductsSection from "./sections/ProductsSection";
import WhyChooseUs from "./sections/WhyChooseUs";
import ContactCTA from "./sections/ContactCTA";

export default function SiteLayout({ config }: { config: SiteConfig }) {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
      <SiteNavbar config={config} />

      <HeroSection config={config} />
     <ProductsSection config={config} />
      <WhyChooseUs config={config} />
      <ContactCTA config={config} />

      <SiteFooter config={config} />
    </div>
  );
}
