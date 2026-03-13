import { Globe, Check, Search } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

const LanguageSettingsCard = () => {
  const [language, setLanguage] = useState("English");
  const [languages, setLanguages] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchLanguages = async () => {
      const res = await fetch(
        "https://restcountries.com/v3.1/all?fields=languages"
      );
      const data = await res.json();

      const set = new Set<string>();

      data.forEach((c: any) => {
        if (c.languages) {
          Object.values(c.languages).forEach((l: any) => set.add(l));
        }
      });

      setLanguages(Array.from(set).sort());
    };

    fetchLanguages();
  }, []);

  const filtered = languages.filter((l) =>
    l.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async () => {
    setSaving(true);

    setTimeout(() => {
      setSaving(false);
      toast.success("Language updated successfully");
      localStorage.setItem("app_language", language);
    }, 800);
  };

  const quickLanguages = ["English", "Hindi", "Spanish", "French"];

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-md p-8">

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">

        <div className="w-11 h-11 rounded-xl bg-[#13538A]/10 flex items-center justify-center">
          <Globe className="w-5 h-5 text-[#13538A]" />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[#13538A]">
            Language Settings
          </h2>

          <p className="text-sm text-gray-500 dark:text-gray-400">
            Select the language you prefer for the platform interface.
          </p>
        </div>

      </div>

      {/* Quick Languages */}
      <div className="flex flex-wrap gap-2 mb-5">
        {quickLanguages.map((lang) => (
          <button
            key={lang}
            onClick={() => setLanguage(lang)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition
            ${
              language === lang
                ? "bg-[#13538A] text-white border-[#13538A]"
                : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-[#13538A]"
            }`}
          >
            {lang}
          </button>
        ))}
      </div>

      {/* Dropdown */}
      <div className="relative mb-6">

        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-2">
          Display Language
        </label>

        <button
          onClick={() => setOpen(!open)}
          className="w-full text-sm flex items-center justify-between border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-white hover:border-[#13538A] transition"
        >
          {language}
        </button>

        {open && (
          <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl">

            {/* Search */}
            <div className="relative border-b dark:border-gray-700">

              <Search
                size={14}
                className="absolute left-3 top-3 text-gray-400"
              />

              <input
                placeholder="Search language..."
                className="w-full pl-8 pr-3 py-2 bg-transparent text-sm outline-none"
                onChange={(e) => setSearch(e.target.value)}
              />

            </div>

            {/* List */}
            <div className="max-h-60 overflow-y-auto">

              {filtered.map((lang) => (
                <div
                  key={lang}
                  onClick={() => {
                    setLanguage(lang);
                    setOpen(false);
                  }}
                  className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <span>{lang}</span>

                  {language === lang && (
                    <Check className="w-4 h-4 text-[#13538A]" />
                  )}
                </div>
              ))}

            </div>

          </div>
        )}

      </div>

      {/* Selected Language */}
      <div className="mb-6 text-sm text-gray-500 dark:text-gray-400">
        Selected language:{" "}
        <span className="px-2 py-1 text-xs rounded-md bg-[#13538A]/10 text-[#13538A] font-medium">
          {language}
        </span>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="px-5 text-sm py-2.5 rounded-lg bg-[#13538A] text-white hover:bg-[#0f436e] transition font-medium shadow"
      >
        {saving ? "Saving..." : "Save Changes"}
      </button>

      {/* Info */}
      <div className="mt-6 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">

        <h3 className="text-sm font-semibold mb-1 dark:text-white">
          How it works
        </h3>

        <p className="text-sm text-gray-600 dark:text-gray-300">
          When you select a different language, the interface content updates
          automatically. Your preference is stored locally so the same language
          is used whenever you return.
        </p>

      </div>

    </div>
  );
};

export default LanguageSettingsCard;