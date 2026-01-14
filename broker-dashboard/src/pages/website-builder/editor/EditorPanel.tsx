import { useState } from "react";
import { SiteConfig } from "../../../types/siteBuilder";
import BrandingTab from "./tabs/BrandingTab";
import HomeTab from "./tabs/HomeTab";
import AboutTab from "./tabs/AboutTab";
import ProductsTab from "./tabs/ProductsTab";
import ContactTab from "./tabs/ContactTab";
import WhyChooseUsTab from "./tabs/WhyChooseUsTab";

const tabs = ["branding", "home", "about", "products", "why", "contact"] as const;

export default function EditorPanel({
  config,
  setConfig,
}: {
  config: SiteConfig;
  setConfig: (c: SiteConfig) => void;
}) {
  const [activeTab, setActiveTab] = useState<typeof tabs[number]>("home");

  return (
    <div className="h-full bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-xl overflow-hidden flex flex-col">

      {/* HEADER */}
      <div className="p-4 border-b dark:border-slate-800 font-semibold">
        Website Builder
      </div>

      {/* TABS */}
      <div className="flex overflow-x-auto border-b dark:border-slate-800">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`flex-1 py-3 text-sm font-medium capitalize ${
              activeTab === t
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-slate-500"
            }`}
          >
            {t === "why" ? "Why Us" : t}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-auto p-4 space-y-4">

        {activeTab === "branding" && (
          <BrandingTab config={config} setConfig={setConfig} />
        )}

        {activeTab === "home" && (
          <HomeTab config={config} setConfig={setConfig} />
        )}

        {activeTab === "about" && (
          <AboutTab />
        )}

        {activeTab === "products" && (
          <ProductsTab config={config} setConfig={setConfig} />
        )}

        {activeTab === "why" && (
          <WhyChooseUsTab config={config} setConfig={setConfig} />
        )}

        {activeTab === "contact" && (
          <ContactTab config={config} setConfig={setConfig} />
        )}

      </div>

      {/* SAVE BUTTON */}
      <div className="p-4 border-t dark:border-slate-800">
        <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold">
          Save Changes
        </button>
      </div>

    </div>
  );
}
