import { useState } from "react";
import GetLoanPreview from "../../pages/website-builder/preview/GetLoanPreview";
import { SiteConfig } from "../../types/siteBuilder";
import SiteNavbar from "./SiteNavbar";
import SiteFooter from "./SiteFooter";
import HeroSection from "./sections/HeroSection";
import ProductsSection from "./sections/ProductsSection";
import WhyChooseUs from "./sections/WhyChooseUs";
import FundedDealsMap from "./sections/FundedDealsMap";
import ContactPage from "../../pages/website-builder/preview/ContactPage";
import AboutPage from "../../pages/website-builder/preview/AboutPage";
import HowItWorksSection from "./sections/HowItWorksSection";
import ReviewSection from "./sections/Reviews";
import StatsSection from "./sections/StatsSection";

export default function SiteLayout({ config }: { config: SiteConfig }) {
  const [activePage, setActivePage] = useState<
    "home" | "about" | "get-loan" | "contact"
  >("home");

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
      <SiteNavbar
        config={config}
        onNavigate={setActivePage}
        activePage={activePage}
      />

      {/* PAGE SWITCHER */}
      {activePage === "home" && (
        <>
          <HeroSection config={config} />
          <ProductsSection config={config} />
          <HowItWorksSection config={config} onNavigate={setActivePage} />
          <WhyChooseUs config={config} />
          <StatsSection />
          <ReviewSection />
          <FundedDealsMap />
        </>
      )}

      {activePage === "about" && <AboutPage config={config} />}
      {activePage === "get-loan" && <GetLoanPreview />}
      {activePage === "contact" && <ContactPage config={config} />}

      <SiteFooter config={config} />
    </div>
  );
}
