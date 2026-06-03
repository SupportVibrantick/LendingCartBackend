import Chart from "react-apexcharts";
import { ApexOptions } from "apexcharts";

interface ProductVolumePoint {
  product: string;
  totalApprovedAmount: number;
}

interface BrokerStats {
  productWiseApprovedVolume: ProductVolumePoint[];
}

interface Props {
  stats: BrokerStats | null;
  loading: boolean;
}

function formatCurrency(value: number) {
  if (!value) {
    return "$0";
  }

  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }

  return `$${Math.round(value)}`;
}

export default function ProductVolumeChart({ stats, loading }: Props) {
  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-white/[0.03]">
        <p className="text-sm text-slate-500">Loading product performance...</p>
      </div>
    );
  }

  if (!stats) return null;

  const products = (stats.productWiseApprovedVolume || []).slice(0, 5);

  const options: ApexOptions = {
    chart: {
      fontFamily: "Outfit, sans-serif",
      toolbar: { show: false },
    },
    colors: ["#0F766E"],
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 8,
        barHeight: "58%",
      },
    },
    dataLabels: {
      enabled: false,
    },
    grid: {
      borderColor: "#E2E8F0",
      strokeDashArray: 4,
    },
    xaxis: {
      categories: products.map((item) => item.product.replace(/_/g, " ")),
      labels: {
        formatter: (value) => formatCurrency(Number(value)),
      },
    },
    tooltip: {
      y: {
        formatter: (value) => formatCurrency(value),
      },
    },
  };

  const series = [
    {
      name: "Approved Volume",
      data: products.map((item) => Number(item.totalApprovedAmount || 0)),
    },
  ];

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-white/[0.03]">
      <div className="mb-6">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-sky-600">
          Product Performance
        </p>
        <h3 className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">
          Top products by approved volume
        </h3>
      </div>

      {products.length > 0 ? (
        <Chart options={options} series={series} type="bar" height={340} />
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-800">
          Approved product volume will appear here once applications start
          moving through the pipeline.
        </div>
      )}
    </div>
  );
}
