"use client";

import {
  BriefcaseBusiness,
  Clock3,
  FileText,
  MessageCircleMore,
  // Search,
  Bell,
} from "lucide-react";

import { motion } from "framer-motion";

const stats = [
  {
    title: "Assigned Applications",
    value: "24",
    icon: BriefcaseBusiness,
    color: "from-cyan-500 to-blue-600",
  },
  {
    title: "Pending Documents",
    value: "08",
    icon: FileText,
    color: "from-violet-500 to-indigo-600",
  },
  {
    title: "Unread Messages",
    value: "12",
    icon: MessageCircleMore,
    color: "from-emerald-500 to-green-600",
  },
  {
    title: "In Review",
    value: "06",
    icon: Clock3,
    color: "from-orange-500 to-amber-600",
  },
];

const recentApplications = [
  {
    id: "APP-1001",
    borrower: "ABC Holdings LLC",
    amount: "$2.5M",
    status: "IN REVIEW",
  },
  {
    id: "APP-1002",
    borrower: "Prime Estate Group",
    amount: "$850K",
    status: "PENDING DOCS",
  },
  {
    id: "APP-1003",
    borrower: "Sunrise Ventures",
    amount: "$1.2M",
    status: "APPROVED",
  },
];


const getStatusStyle = (status: string) => {
  switch (status.toLowerCase()) {
    case "approved":
      return "bg-emerald-50 text-emerald-600 border border-emerald-100";

    case "pending docs":
      return "bg-amber-50 text-amber-600 border border-amber-100";

    default:
      return "bg-cyan-50 text-cyan-600 border border-cyan-100";
  }
};

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        {/* HEADER */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            {/* LEFT */}
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1">
                <div className="h-1.5 w-1.5 rounded-full bg-cyan-500" />

                <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-700">
                  Co-Broker Portal
                </span>
              </div>

              <h1 className="mt-3 text-2xl font-bold text-slate-900">
                Welcome Back 👋
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Manage loan applications, upload documents, track status,
                and communicate with brokers from one place.
              </p>

              {/* SEARCH */}
              {/* <div className="mt-4 flex max-w-md items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <Search size={16} className="text-slate-400" />

                <input
                  type="text"
                  placeholder="Search applications..."
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                />
              </div> */}
            </div>

          {/* RIGHT */}
<div className="flex items-center gap-3">
  {/* NOTIFICATION */}
  <button className="group relative flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white transition-all duration-200 hover:border-cyan-200 hover:bg-cyan-50">
    <Bell
      size={17}
      className="text-slate-600 transition group-hover:text-cyan-600"
    />

    {/* DOT */}
    <span className="absolute right-2.5 top-2.5 flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />

      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
    </span>
  </button>

  {/* PROFILE */}
  <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 transition-all duration-200 hover:border-slate-300">
    {/* AVATAR */}
    <div className="relative">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 via-sky-500 to-blue-600 text-sm font-bold text-white">
        SB
      </div>

      {/* ACTIVE DOT */}
      <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
    </div>

    {/* INFO */}
    <div>
      <h3 className="text-sm font-semibold leading-none text-slate-900">
        Co-Broker
      </h3>

      <p className="mt-1 text-xs text-slate-500">
        Affiliate Partner
      </p>

      {/* STATUS */}
      <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1">
        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />

        <span className="text-[10px] font-semibold text-emerald-600">
          Active
        </span>
      </div>
    </div>
  </div>
</div>
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((item, index) => {
            const Icon = item.icon;

            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: index * 0.1,
                }}
                className="rounded-3xl border border-slate-200 bg-white p-5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      {item.title}
                    </p>

                    <h2 className="mt-2 text-3xl font-bold text-slate-900">
                      {item.value}
                    </h2>
                  </div>

                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${item.color}`}
                  >
                    <Icon size={18} className="text-white" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* MAIN GRID */}
        <div className=" gap-5 xl:grid-cols-3">
          {/* APPLICATIONS */}
          <div className="xl:col-span-2">
            <div className="rounded-3xl border border-slate-200 bg-white">
              {/* HEADER */}
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Recent Applications
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    Recently assigned applications
                  </p>
                </div>

                <button className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50">
                  View All
                </button>
              </div>

              {/* TABLE */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      {[
                        "Application",
                        "Borrower",
                        "Amount",
                        "Status",
                      ].map((head) => (
                        <th
                          key={head}
                          className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                        >
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {recentApplications.map((item) => (
                      <tr
                        key={item.id}
                        className="border-t border-slate-100 hover:bg-slate-50"
                      >
                        <td className="px-5 py-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {item.id}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              Commercial Loan
                            </p>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {item.borrower}
                        </td>

                        <td className="px-5 py-4 text-sm font-medium text-slate-800">
                          {item.amount}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${getStatusStyle(
                              item.status
                            )}`}
                          >
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>          
        </div>
      </div>
    </div>
  );
}