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

  // Define professional, high-contrast themes
  const themes: Record<string, string> = {
    teal: "bg-gradient-to-r from-[#4FCDCC] to-[#18B6B4]",
    sky: "bg-gradient-to-r from-[#37C9EF] to-[#2C92D5]",
    blue: "bg-gradient-to-r from-[#2C92D5] to-[#13538A]",
    navy: "bg-gradient-to-r from-[#13538A] to-[#0F3E68]",
  };

  const metrics = [
    {
      title: "Organizations",
      value: stats.organizations.total,
      icon: <Building2 />,
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 p-2">
      {metrics.map((item, index) => (
        <div
          key={index}
          className={`group relative h-[100px] w-full overflow-hidden rounded-2xl transition-all duration-500 hover:-translate-y-2 shadow-xl hover:shadow-2xl`}
        >
          {/* Background Gradient */}
          <div
            className={`absolute inset-0 bg-gradient-to-br ${themes[item.color]}`}
          />

          {/* Abstract Glass shapes for "Beauty" */}
          <div className="absolute -right-2 -bottom-2 h-16 w-16 rounded-full bg-white/10 blur-xl group-hover:scale-150 transition-transform duration-700" />
          <div className="absolute left-1/2 top-0 h-full w-12 -skew-x-12 bg-white/5 blur-sm" />

          <div className="relative h-full flex items-center px-5 gap-4 text-white">
            {/* Glass Icon Container */}
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-lg border border-white/30 shadow-lg group-hover:rotate-6 transition-transform">
              {/* Clone icon to apply classes properly */}
              {item.icon && typeof item.icon === "object"
                ? {
                    ...item.icon,
                    props: {
                      ...item.icon.props,
                      className: "w-6 h-6 text-white",
                    },
                  }
                : item.icon}
            </div>

            {/* Content */}
            <div className="flex flex-col">
              <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-white/70">
                {item.title}
              </span>
              <span className="text-[26px] font-extrabold tracking-tight">
                {item.value}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
