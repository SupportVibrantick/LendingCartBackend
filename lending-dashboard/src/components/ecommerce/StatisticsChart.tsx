import {
  useEffect,
  useState,
} from "react";

import Chart from "react-apexcharts";

import { ApexOptions } from "apexcharts";

import ChartTab from "../common/ChartTab";

/* ================= DUMMY DATA (LENDER) ================= */

const API_BASE = import.meta.env.VITE_API_BASE ||
  "http://localhost:4000";;

/* ================= COMPONENT ================= */

export default function LenderStatisticsChart() {
  const [stats, setStats] =
  useState<any>(null);

const [loading, setLoading] =
  useState(true);

  const fetchPipelinePerformance =
  async () => {
    try {
      setLoading(true);

      const token =
        sessionStorage.getItem(
          "lender_token",
        );

      const res = await fetch(
        `${API_BASE}/lender/dashboard/pipeline-performance`,
        {
          headers: {
            ...(token && {
              Authorization: `Bearer ${token}`,
            }),
          },
        },
      );

      const json =
        await res.json();

      if (
        !res.ok ||
        !json.success
      ) {
        throw new Error(
          json.message ||
            "Failed to fetch chart stats",
        );
      }

      setStats(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

useEffect(() => {
  fetchPipelinePerformance();
}, []);

  /* ================= SERIES ================= */
  const series = [
  {
    name: "Volume (Count)",

    type: "area" as const,

    data: [
      stats?.totalApplications ||
        0,

      stats?.totalSubmitted ||
        0,

      stats?.totalInReview ||
        0,

      stats?.totalApproved ||
        0,

      stats?.totalFunded ||
        0,
    ],
  },

  {
    name: "Efficiency (%)",

    type: "line" as const,

    data: [
      100,

      stats?.submittedConversion ||
        0,

      stats?.reviewConversion ||
        0,

      stats?.approvalRate || 0,

      stats?.fundingConversion ||
        0,
    ],
  },
];

  /* ================= OPTIONS ================= */

  const options: ApexOptions = {
    chart: {
      fontFamily: "Outfit, sans-serif",
      toolbar: { show: false },
      zoom: { enabled: false },
    },
    colors: ["#3e86b7", "#10B981"],
    stroke: {
      curve: "smooth",
      width: [4, 3],
      dashArray: [0, 8],
    },
    markers: {
      size: 5,
      strokeColors: "#fff",
      strokeWidth: 2,
    },
    grid: {
      borderColor: "#F1F5F9",
      strokeDashArray: 5,
    },
    xaxis: {
      categories: [
        "Applications",
        "Submitted",
        "In Review",
        "Approved",
        "Funded",
      ],
      labels: {
        style: { colors: "#64748b" },
      },
    },
    yaxis: [
      {
        title: { text: "Count" },
        labels: {
          formatter: (val: number) => Math.round(val).toString(),
        },
      },
      {
        opposite: true,
        max: 100,
        title: { text: "Conversion %" },
        labels: {
          formatter: (val: number) => `${val}%`,
        },
      },
    ],
    tooltip: {
      shared: true,
      intersect: false,
      y: {
        formatter: (val: number, opts) =>
          opts.seriesIndex === 1 ? `${val}%` : val.toString(),
      },
    },
    legend: {
      position: "top",
      horizontalAlign: "right",
    },
    fill: {
      type: ["gradient", "solid"],
      gradient: {
        opacityFrom: 0.4,
        opacityTo: 0.05,
      },
    },
  };

  if (loading) {
  return (
    <div
      className="
        h-[520px]
        rounded-2xl
        animate-pulse
        bg-slate-200
        dark:bg-slate-800
      "
    />
  );
}

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="flex flex-col items-center justify-between gap-4 mb-8 sm:flex-row">
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            Lender Pipeline Performance
          </h3>
          <p className="text-sm text-gray-500">
            Dummy conversion tracking across lending stages
          </p>
        </div>
        <ChartTab />
      </div>

      <Chart options={options} series={series} type="line" height={350} />

      <div className="grid grid-cols-1 gap-4 mt-8 sm:grid-cols-2">
        <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800">
          <p className="text-xs uppercase text-gray-500">
            Avg. Approval Rate
          </p>
          <h4 className="mt-1 text-2xl font-bold text-green-600">
            {stats?.approvalRate || 0}%
          </h4>
        </div>

        <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800">
          <p className="text-xs uppercase text-gray-500">
            Funding Success
          </p>
          <h4 className="mt-1 text-2xl font-bold text-blue-600">
            {stats?.fundingConversion || 0}%
          </h4>
        </div>
      </div>
    </div>
  );
}
