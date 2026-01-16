import { SiteConfig } from "../../../../types/siteBuilder";

type Props = {
  config: SiteConfig;
  setConfig: (c: SiteConfig) => void;
};

export default function AboutTab({ config, setConfig }: Props) {
  if (!config || !config.about) {
    return <div className="p-4 text-slate-500">Loading...</div>;
  }

  const about = config.about;

  const uploadImage = (file: File | undefined, cb: (url: string) => void) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => cb(r.result as string);
    r.readAsDataURL(file);
  };

  const updateTeam = (team: typeof about.team) => {
    setConfig({ ...config, about: { ...about, team } });
  };

  return (
    <div className="space-y-4">
      {/* HERO TITLE */}
      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
        <label className="text-sm font-medium">Hero Title</label>
        <input
          value={about.heroTitle}
          onChange={(e) =>
            setConfig({
              ...config,
              about: { ...about, heroTitle: e.target.value },
            })
          }
          className="text-gray-800 text-sm mt-1 w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-900"
        />
      </div>

      {/* DESCRIPTION */}
      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
        <label className="text-sm font-medium">Description</label>
        <textarea
          value={about.description}
          rows={4}
          onChange={(e) =>
            setConfig({
              ...config,
              about: { ...about, description: e.target.value },
            })
          }
          className="text-sm mt-1 w-full border rounded-lg px-3 py-2 text-gray-800 bg-white dark:bg-slate-900"
        />
      </div>

      {/* HEADING COLOR */}
      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
        <label className="text-sm font-medium">Headings Color</label>

        <div className="mt-2 flex items-center gap-4">
          <input
            type="color"
            value={about.headingColor}
            onChange={(e) =>
              setConfig({
                ...config,
                about: { ...about, headingColor: e.target.value },
              })
            }
            className="h-7 w-14 rounded cursor-pointer shadow-sm"
          />

          <input
            type="text"
            value={about.headingColor}
            onChange={(e) =>
              setConfig({
                ...config,
                about: { ...about, headingColor: e.target.value },
              })
            }
            className="text-sm text-gray-800 border rounded-lg px-3 py-2 w-32 bg-white dark:bg-slate-900"
          />
        </div>
      </div>

      {/* HERO IMAGE */}
      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
        <label className="text-sm font-medium">Hero Image</label>

        <div className="mt-2 flex items-center gap-4">
          {about.heroImageUrl ? (
            <img
              src={about.heroImageUrl}
              className="h-20 rounded-lg object-cover border bg-white"
            />
          ) : (
            <div className="h-20 w-32 flex items-center justify-center border rounded text-xs text-slate-400 bg-white">
              No Image
            </div>
          )}

          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) =>
                uploadImage(e.target.files?.[0], (url) =>
                  setConfig({
                    ...config,
                    about: { ...about, heroImageUrl: url },
                  })
                )
              }
            />
            <div className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs">
              Upload Image
            </div>
          </label>
        </div>
      </div>

      {/* TEAM MEMBERS */}
      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-md">Team Members</h3>

          <button
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
            onClick={() =>
              updateTeam([...about.team, { name: "", imageUrl: "" }])
            }
          >
            + Add Member
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {about.team.map((m, i) => (
            <div
              key={i}
              className="relative bg-white dark:bg-slate-900 border rounded-xl p-4 shadow-sm hover:shadow-md transition"
            >
              {/* DELETE BUTTON TOP RIGHT */}
              <button
                className="absolute top-2 right-2 text-slate-400 hover:text-red-600 text-sm"
                onClick={() => {
                  const copy = about.team.filter((_, idx) => idx !== i);
                  updateTeam(copy);
                }}
                title="Remove"
              >
                ✕
              </button>

              {/* IMAGE */}
              <div className="flex justify-center mb-3">
                <img
                  src={
                    m.imageUrl ||
                    "https://lirp.cdn-website.com/3d34d6e7/dms3rep/multi/opt/placeholder-1920w.jpg"
                  }
                  className="h-20 w-20 rounded-full object-cover border bg-white"
                />
              </div>

              {/* NAME */}
              <input
                value={m.name}
                onChange={(e) => {
                  const copy = [...about.team];
                  copy[i] = { ...copy[i], name: e.target.value };
                  updateTeam(copy);
                }}
                className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-900 text-center text-sm text-gray-800"
                placeholder="Member Name"
              />

              {/* UPLOAD BUTTON */}
              <div className="mt-3 flex justify-center">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) =>
                      uploadImage(e.target.files?.[0], (url) => {
                        const copy = [...about.team];
                        copy[i] = { ...copy[i], imageUrl: url };
                        updateTeam(copy);
                      })
                    }
                  />
                  <div className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs">
                    Change Photo
                  </div>
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
