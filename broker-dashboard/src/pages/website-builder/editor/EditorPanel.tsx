import { useState } from "react";
import { SiteConfig } from "../../../types/siteBuilder";
import BrandingTab from "./tabs/BrandingTab";
import HomeTab from "./tabs/HomeTab";
import AboutTab from "./tabs/AboutTab";
import ProductsTab from "./tabs/ProductsTab";
import ContactTab from "./tabs/ContactTab";
import WhyChooseUsTab from "./tabs/WhyChooseUsTab";
import FooterTab from "./tabs/FooterTab";
import HowItWorksTab from "./tabs/HowItWorksTab";

import {
  Palette,
  Home,
  Info,
  Package,
  Phone,
  LayoutDashboard,
  Footprints,
  HelpCircle,
  ChevronDown,
} from "lucide-react";

const tabs = [
  { key: "branding", label: "Branding", icon: Palette },
  { key: "home", label: "Home", icon: Home },
  { key: "about", label: "About", icon: Info },
  { key: "products", label: "Products", icon: Package },
  { key: "why", label: "Why Us", icon: HelpCircle },
  { key: "howitworks", label: "How It Works", icon: LayoutDashboard },
  { key: "contact", label: "Contact", icon: Phone },
  { key: "footer", label: "Footer", icon: Footprints },
] as const;

type TabKey = (typeof tabs)[number]["key"];

export default function EditorPanel({
  config,
  setConfig,
}: {
  config: SiteConfig;
  setConfig: (c: SiteConfig) => void;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [open, setOpen] = useState(false);

  const activeTabData = tabs.find((t) => t.key === activeTab)!;

  return (
    <div className="h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col">
      {/* HEADER */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white font-semibold text-sm">
        Website Builder
      </div>

      {/* SECTION SELECTOR */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 relative">
        <div
          onClick={() => setOpen((o) => !o)}
          className="flex items-center justify-between cursor-pointer border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition text-slate-800 dark:text-white"
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <activeTabData.icon size={18} />
            </div>

            <div>
              <div className="text-sm font-semibold">{activeTabData.label}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Editing section
              </div>
            </div>
          </div>

          <ChevronDown
            className={`transition text-slate-600 dark:text-slate-300 ${
              open ? "rotate-180" : ""
            }`}
            size={18}
          />
        </div>

        {/* DROPDOWN */}
        {open && (
          <div className="absolute z-50 left-4 right-4 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden">
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.key;

              return (
                <div
                  key={t.key}
                  onClick={() => {
                    setActiveTab(t.key);
                    setOpen(false);
                  }}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition
                    ${
                      active
                        ? "bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                >
                  <div
                    className={`h-8 w-8 rounded-lg flex items-center justify-center transition ${
                      active
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    <Icon size={16} />
                  </div>

                  <div className="flex-1">
                    <div className="text-sm font-medium">{t.label}</div>
                  </div>

                  {active && (
                    <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-auto p-4 space-y-4 text-slate-800 dark:text-slate-100">
        {activeTab === "branding" && (
          <BrandingTab config={config} setConfig={setConfig} />
        )}
        {activeTab === "home" && (
          <HomeTab config={config} setConfig={setConfig} />
        )}
        {activeTab === "about" && (
          <AboutTab config={config} setConfig={setConfig} />
        )}
        {activeTab === "products" && (
          <ProductsTab config={config} setConfig={setConfig} />
        )}
        {activeTab === "why" && (
          <WhyChooseUsTab config={config} setConfig={setConfig} />
        )}
        {activeTab === "howitworks" && (
          <HowItWorksTab config={config} setConfig={setConfig} />
        )}
        {activeTab === "contact" && (
          <ContactTab config={config} setConfig={setConfig} />
        )}
        {activeTab === "footer" && (
          <FooterTab config={config} setConfig={setConfig} />
        )}
      </div>

      {/* SAVE BUTTON */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800">
        <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold text-xs">
          Save Changes
        </button>
      </div>
    </div>
  );
}
