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
      logoColor: "#2563eb",
    },
    home: {
      heroHeading: "Get Your Loan Fast & Easy",
      heroSubheading: "Home Loans, Business Loans & More",
      ctaText: "Apply Now",
      heroImageUrl: "",
    },
    about: {
      heroTitle: "We Are Modernizing the Commercial Lending Industry",
      description:
        "By using the latest technology like AI, modern web design...",
      heroImageUrl: "",
      headingColor: "#1e40af",
      team: [
        { name: "Team Member 1", imageUrl: "" },
        { name: "Team Member 2", imageUrl: "" },
        { name: "Team Member 3", imageUrl: "" },
        { name: "Team Member 4", imageUrl: "" },
      ],
    },
    products: [
      {
        title: "Home Loan",
        description: "Low EMIs, Quick Approval",
        imageUrl: "",
      },
      {
        title: "Business Loan",
        description: "Funds to Grow Your Business",
        imageUrl: "",
      },
      {
        title: "Personal Loan",
        description: "Instant Personal Loans",
        imageUrl: "",
      },
    ],
    whyChooseUs: [
      {
        title: "Fast Approval",
        description: "Quick and easy loan approval process",
      },
      {
        title: "Best Rates",
        description: "We provide competitive interest rates",
      },
      {
        title: "Expert Support",
        description: "Our experts guide you at every step",
      },
    ],
    contact: {
      phone: "9876543210",
      whatsapp: "9876543210",
      address: "Punjab, Mohali",
      workingHours: "Mon - Sat, 10:00 AM - 7:00 PM",
    },
    howItWorks: {
      enabled: true,
      title: "How Raj FinCorp Works",
      ctaText: "Get a Loan",
      steps: [
        {
          title: "Submit One Loan Request",
          description: "Fill one simple application",
          iconUrl:
            "https://lirp.cdn-website.com/3d34d6e7/dms3rep/multi/opt/step-1a-1b59da6f-150w.png",
        },
        {
          title: "Multiple Lenders Review",
          description: "Your request is reviewed by lenders",
          iconUrl:
            "https://lirp.cdn-website.com/3d34d6e7/dms3rep/multi/opt/step-2.-150w.png",
        },
        {
          title: "Get Loan Offers",
          description: "Compare & choose best offer",
          iconUrl:
            "https://lirp.cdn-website.com/3d34d6e7/dms3rep/multi/opt/step-3a-a10ec3c6-150w.png",
        },
      ],
    },
    footer: {
      bgColor: "#0f172a",
      text: "© 2026 Raj FinCorp. All rights reserved.",
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
