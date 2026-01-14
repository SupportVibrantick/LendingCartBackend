import { useState } from "react";
import { SiteConfig } from "../../types/siteBuilder";
import SitePreview from "./SitePreview";
import EditorPanel from "./editor/EditorPanel";

export default function ConfigWebsite() {
 const [config, setConfig] = useState<SiteConfig>({
  branding: {
    brandName: "Raj FinCorp",
    primaryColor: "#2563eb",
    logoUrl: "",
  },
  home: {
    heroHeading: "Get Your Loan Fast & Easy",
    heroSubheading: "Home Loans, Business Loans & More",
    ctaText: "Apply Now",
    heroImageUrl: "",
  },
  products: [
    { title: "Home Loan", description: "Low EMIs, Quick Approval" },
    { title: "Business Loan", description: "Funds to Grow Your Business" },
    { title: "Personal Loan", description: "Instant Personal Loans" },
  ],
  whyChooseUs: [
    { title: "Fast Approval" },
    { title: "Low Interest Rates" },
    { title: "Expert Support" },
  ],
  contact: {
    phone: "9876543210",
    whatsapp: "9876543210",
  },
});


  return (
    <div className="flex gap-4 h-[calc(100vh-140px)]">

      {/* LEFT: PREMIUM EDITOR */}
      <div className="w-[420px] shrink-0">
        <EditorPanel config={config} setConfig={setConfig} />
      </div>

      {/* RIGHT: LIVE PREVIEW */}
      <div className="flex-1 bg-slate-100 dark:bg-slate-950 rounded-xl p-4 overflow-auto">
        <SitePreview config={config} />
      </div>

    </div>
  );
}
