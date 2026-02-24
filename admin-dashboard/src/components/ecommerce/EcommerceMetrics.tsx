import {
  Building2,
  Users,
  FileText,
  DollarSign,
  Link,
  Package,
  Activity,
  Loader2,
} from "lucide-react";

interface DashboardStats {
  organizations: { total: number };
  users: { total: number };
  applications: {
    total: number;
    fundedVolume: number;
    last7Days: number;
  };
  lenders: {
    connections: number;
    products: number;
  };
}

interface Props {
  stats: DashboardStats | null;
}

export default function EcommerceMetrics({ stats }: Props) {
  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin mb-3 text-indigo-600" />
        <p className="text-sm font-medium">Syncing live dashboard...</p>
      </div>
    );
  }

  // Define professional, high-contrast themes
  const themes: Record<string, string> = {
    teal: "from-[#14B8A6] via-[#0D9488] to-[#0F766E]",
    sky: "from-[#38BDF8] via-[#0EA5E9] to-[#0369A1]",
    blue: "from-[#3B82F6] via-[#1D4ED8] to-[#1E3A8A]",
    navy: "from-[#1E293B] via-[#0F172A] to-[#020617]",
  };

  const metrics = [
    {
      title: "Organizations",
      value: stats.organizations.total,
      icon: <Building2 className="w-5 h-5 text-white" />,
      color: "teal",
    },
    {
      title: "Users",
      value: stats.users.total,
      icon: <Users />,
      color: "sky",
    },
    {
      title: "Applications",
      value: stats.applications.total,
      icon: <FileText />,
      color: "blue",
    },
    {
      title: "Funded Volume",
      value: `$${stats.applications.fundedVolume.toLocaleString()}`,
      icon: <DollarSign />,
      color: "navy",
    },
    {
      title: "7 Day Applications",
      value: stats.applications.last7Days,
      icon: <Activity />,
      color: "sky",
    },
    {
      title: "Lender Connections",
      value: stats.lenders.connections,
      icon: <Link />,
      color: "teal",
    },
    {
      title: "Products",
      value: stats.lenders.products,
      icon: <Package />,
      color: "blue",
    },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {metrics.map((item, index) => (
        <div
          key={index}
          className="
  bg-white dark:bg-slate-900
  border border-slate-200 dark:border-slate-800
  rounded-2xl
  shadow-sm dark:shadow-slate-950/40
  hover:shadow-md dark:hover:shadow-slate-900/60
  transition-all duration-300
  p-5 flex items-center justify-between"
        >
          {/* Left Content */}
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {item.title}
            </p>

            <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              {item.value}
            </h3>
          </div>

          {/* Icon */}
          <div
            className={`h-8 w-8 flex items-center justify-center 
                rounded-full text-white 
                bg-gradient-to-br ${themes[item.color]}`}
          >
            {item.icon}
          </div>
        </div>
      ))}
    </div>
  );
}
