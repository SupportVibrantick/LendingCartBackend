import { SiteConfig } from "../../../../types/siteBuilder";
import { Trash2, Plus, Upload } from "lucide-react";

export default function HowItWorksTab({
  config,
  setConfig,
}: {
  config: SiteConfig;
  setConfig: (c: SiteConfig) => void;
}) {
  const h = config.howItWorks;

  const updateSteps = (steps: typeof h.steps) => {
    setConfig({ ...config, howItWorks: { ...h, steps } });
  };

  const handleIconUpload = (file: File | undefined, index: number) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const copy = [...h.steps];
      copy[index] = { ...copy[index], iconUrl: reader.result as string };
      updateSteps(copy);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">

      {/* ENABLE */}
      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl flex items-center justify-between">
        <div>
          <div className="font-semibold">Show Section</div>
          <div className="text-xs text-slate-500">
            Enable / Disable "How It Works" section
          </div>
        </div>

        <input
          type="checkbox"
          className="scale-125"
          checked={h.enabled}
          onChange={(e) =>
            setConfig({
              ...config,
              howItWorks: { ...h, enabled: e.target.checked },
            })
          }
        />
      </div>

      {/* TITLE */}
      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
        <label className="text-sm font-medium">Section Title</label>
        <input
          value={h.title}
          onChange={(e) =>
            setConfig({
              ...config,
              howItWorks: { ...h, title: e.target.value },
            })
          }
          className="text-sm text-gray-800 mt-1 w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-900"
        />
      </div>

      {/* CTA */}
      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
        <label className="text-sm font-medium">Button Text</label>
        <input
          value={h.ctaText}
          onChange={(e) =>
            setConfig({
              ...config,
              howItWorks: { ...h, ctaText: e.target.value },
            })
          }
          className="text-sm text-gray-800 mt-1 w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-900"
        />
      </div>

      {/* STEPS */}
      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
        <div className="flex justify-between items-center mb-4">
          <div className="font-semibold">Steps</div>
          <button
            className="text-xs flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg"
            onClick={() =>
              updateSteps([
                ...h.steps,
                { title: "Step Title", description: "Step Description", iconUrl: "https://lirp.cdn-website.com/3d34d6e7/dms3rep/multi/opt/step-3a-a10ec3c6-150w.png" },
              ])
            }
          >
            <Plus size={16} />
            Add Step
          </button>
        </div>

        <div className="space-y-4">
          {h.steps.map((s, i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-900 border rounded-xl p-4 space-y-4"
            >
              {/* HEADER */}
              <div className="flex items-center justify-between">
                <div className="font-semibold">Step {i + 1}</div>

                <button
                  className="text-red-600 hover:bg-red-50 p-2 rounded-lg"
                  onClick={() =>
                    updateSteps(h.steps.filter((_, idx) => idx !== i))
                  }
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* ICON UPLOAD */}
              <div>
                <label className="text-sm font-medium">Step Icon</label>

                <div className="flex items-center gap-4 mt-2">
                  {s.iconUrl ? (
                    <img
                      src={s.iconUrl}
                      className="h-16 w-16 rounded-full object-contain border bg-white p-2"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-full flex items-center justify-center border text-xs text-slate-400 bg-white">
                      No Icon
                    </div>
                  )}

                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        handleIconUpload(e.target.files?.[0], i)
                      }
                    />
                    <div className="text-xs flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg">
                      <Upload size={16} />
                      Upload Icon
                    </div>
                  </label>

                  {s.iconUrl && (
                    <button
                      className="text-red-600 text-xs"
                      onClick={() => {
                        const copy = [...h.steps];
                        copy[i] = { ...copy[i], iconUrl: "" };
                        updateSteps(copy);
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              {/* TITLE */}
              <input
                value={s.title}
                onChange={(e) => {
                  const copy = [...h.steps];
                  copy[i] = { ...copy[i], title: e.target.value };
                  updateSteps(copy);
                }}
                className="text-sm text-gray-800 w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-900"
                placeholder="Step Title"
              />

              {/* DESCRIPTION */}
              <textarea
                value={s.description}
                onChange={(e) => {
                  const copy = [...h.steps];
                  copy[i] = { ...copy[i], description: e.target.value };
                  updateSteps(copy);
                }}
                className="text-sm text-gray-800 w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-900"
                placeholder="Step Description"
                rows={2}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
