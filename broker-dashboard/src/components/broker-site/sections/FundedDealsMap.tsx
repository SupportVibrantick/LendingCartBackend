import { MapPin } from "lucide-react";

const FundedDealsMap = () => {
  const locations = [
    { id: 1, x: "15%", y: "65%", isMain: true },
    { id: 2, x: "25%", y: "72%", isMain: false },
    { id: 3, x: "45%", y: "82%", isMain: false },
    { id: 4, x: "58%", y: "42%", isMain: true },
    { id: 5, x: "65%", y: "68%", isMain: true },
    { id: 6, x: "78%", y: "40%", isMain: true },
    { id: 7, x: "82%", y: "35%", isMain: false },
    { id: 8, x: "70%", y: "55%", isMain: false },
  ];

  return (
    <section className="w-full py-20 bg-white dark:bg-slate-950 overflow-hidden">
      <div className="max-w-6xl mx-auto px-6 text-center">

        {/* TITLE */}
        <div className="relative inline-block mb-16">
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white relative z-10">
            Recently Funded Deals
          </h2>
          <div className="absolute bottom-1 left-0 w-full h-4 bg-cyan-400/40 dark:bg-cyan-500/30 -z-0"></div>
        </div>

        {/* MAP */}
        <div
          className="relative w-full aspect-[16/9] md:aspect-[21/9] bg-no-repeat bg-contain bg-center rounded-xl"
          style={{
            backgroundImage: `url('https://upload.wikimedia.org/wikipedia/commons/1/1a/Blank_US_Map_%28states_only%29.svg')`,
          }}
        >
          {/* SOFT OVERLAY FOR DARK MODE */}
          <div className="absolute inset-0 bg-white/60 dark:bg-slate-950/40 rounded-xl"></div>

          {/* PINS */}
          {locations.map((loc) => (
            <div
              key={loc.id}
              className="absolute z-10 transform -translate-x-1/2 -translate-y-1/2"
              style={{ left: loc.x, top: loc.y }}
            >
              {loc.isMain ? (
                <div className="relative">
                  <MapPin className="text-slate-800 dark:text-cyan-400 w-6 h-6 md:w-8 md:h-8 fill-current drop-shadow-md" />
                  <span className="absolute top-0 left-0 w-full h-full rounded-full animate-ping bg-cyan-400 opacity-50"></span>
                </div>
              ) : (
                <div className="relative flex items-center justify-center">
                  <div className="w-2.5 h-2.5 md:w-3 md:h-3 bg-cyan-500 rounded-full border-2 border-white dark:border-slate-900 shadow-sm"></div>
                  <div className="absolute w-6 h-6 bg-cyan-400 rounded-full animate-pulse opacity-30"></div>
                </div>
              )}
            </div>
          ))}

          {/* STATS CARD */}
          <div className="absolute bottom-4 left-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm p-4 rounded-xl border border-slate-200 dark:border-slate-800 hidden md:block shadow">
            <p className="text-slate-900 dark:text-white font-bold text-lg">
              5,000+ Deals Funded
            </p>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Across the nation this year
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FundedDealsMap;
