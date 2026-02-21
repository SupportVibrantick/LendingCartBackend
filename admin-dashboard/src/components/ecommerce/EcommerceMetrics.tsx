import {
  Building2,
  Users,
  FileText,
  DollarSign,
  Link,
  Package,
  ShieldAlert,
  Activity,
  Loader2,
} from "lucide-react";

interface Props {
  stats: any;
}

export default function EcommerceMetrics({ stats }: Props) {
  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mb-3 text-indigo-600" />
        <p className="text-sm font-medium">Syncing live dashboard...</p>
      </div>
    );
  }

  const ruleFailPercent =
    stats.ruleEngine.totalEvaluations > 0
      ? ((stats.ruleEngine.failedRules / stats.ruleEngine.totalEvaluations) * 100).toFixed(1)
      : 0;

  // Matching your screenshot colors exactly but with professional depth
  const metrics = [
    { title: "Organizations", value: stats.organizations.total, icon: <Building2 />, color: "ocean" },
    { title: "Users", value: stats.users.total, icon: <Users />, color: "sunset" },
    { title: "Applications", value: stats.applications.total, icon: <FileText />, color: "royal" },
    { title: "Funded Volume", value: `$${stats.applications.fundedVolume.toLocaleString()}`, icon: <DollarSign />, color: "emeraldGlow" },
    { title: "7 Day Applications", value: stats.applications.last7Days, icon: <Activity />, color: "violetPink" },
    { title: "Lender Connections", value: stats.lenders.connections, icon: <Link />, color: "cyanSky" },
    { title: "Products", value: stats.lenders.products, icon: <Package />, color: "amberFire" },
    { title: "Active Relationships", value: stats.relationships.activeBrokerLenderLinks, icon: <Link />, color: "tealMint" },
    { title: "Rule Failure %", value: `${ruleFailPercent}%`, icon: <ShieldAlert />, color: "crimsonHeat" },
  ];

  const themes: Record<string, string> = {
    ocean: "from-blue-500 via-blue-600 to-indigo-700 shadow-blue-500/25",
    sunset: "from-pink-500 via-rose-500 to-orange-500 shadow-rose-500/25",
    royal: "from-indigo-500 via-purple-600 to-violet-700 shadow-purple-500/25",
    emeraldGlow: "from-emerald-400 via-green-500 to-teal-600 shadow-emerald-500/25",
    violetPink: "from-fuchsia-500 via-purple-600 to-indigo-600 shadow-fuchsia-500/25",
    cyanSky: "from-cyan-400 via-sky-500 to-blue-600 shadow-cyan-500/25",
    amberFire: "from-amber-400 via-orange-500 to-red-500 shadow-orange-500/25",
    tealMint: "from-teal-400 via-emerald-500 to-green-600 shadow-teal-500/25",
    crimsonHeat: "from-red-500 via-rose-600 to-pink-600 shadow-red-500/25",
  };

  return (
    // Grid matches your screenshot layout
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-1">
      {metrics.map((item, index) => (
        <div
          key={index}
          className={`group relative h-[90px] w-full overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:brightness-110`}
        >
          {/* Background Gradient Layer */}
          <div className={`absolute inset-0 bg-gradient-to-br ${themes[item.color]} shadow-lg`} />
          
          {/* Subtle Shine/Glass Effect */}
          <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10 blur-2xl group-hover:bg-white/20 transition-all" />
          
          <div className="relative h-full flex items-center px-6 gap-5 text-white">
            {/* Icon Container */}
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md border border-white/20 shadow-inner">
              {Object.assign({}, item.icon, { props: { className: "w-6 h-6 text-white drop-shadow-md" } })}
            </div>

            {/* Labels */}  
            <div className="flex flex-col">
              <span className="text-[12px] font-semibold uppercase tracking-widest text-white/80 leading-tight">
                {item.title}
              </span>
              <span className="text-[24px] font-black tracking-tight mt-0.5">
                {item.value}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}