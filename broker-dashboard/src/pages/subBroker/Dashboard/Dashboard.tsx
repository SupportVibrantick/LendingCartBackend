import {
  BriefcaseBusiness,
  Clock3,
  FileText,
  MessageCircleMore,
} from "lucide-react";

import { motion } from "framer-motion";

const stats = [
  {
    title: "Assigned Applications",
    value: "24",
    icon: BriefcaseBusiness,
  },
  {
    title: "Pending Documents",
    value: "8",
    icon: FileText,
  },
  {
    title: "Unread Messages",
    value: "12",
    icon: MessageCircleMore,
  },
  {
    title: "In Review",
    value: "6",
    icon: Clock3,
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

export default function Dashboard() {
  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="flex flex-col justify-between gap-4 rounded-[32px] border border-white bg-white/80 p-8 shadow-xl shadow-slate-200/50 backdrop-blur-xl lg:flex-row lg:items-center">
        <div>
          <p className="text-sm font-medium text-cyan-600">Sub Broker Portal</p>

          <h1 className="mt-2 text-4xl font-black text-slate-900">
            Welcome Back 👋
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">
            Manage assigned loan applications, review documents, communicate
            with brokers, and track loan progress from one centralized portal.
          </p>
        </div>

        {/* PROFILE */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-lg font-bold text-white shadow-lg shadow-cyan-300/40">
            SB
          </div>

          <div>
            <h3 className="font-semibold text-slate-900">Sub Broker</h3>

            <p className="text-sm text-slate-500">Affiliate Partner</p>
          </div>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((item, index) => {
          const Icon = item.icon;

          return (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                delay: index * 0.1,
              }}
              whileHover={{
                y: -5,
              }}
              className="group rounded-[28px] border border-white bg-white/80 p-6 shadow-lg shadow-slate-200/40 backdrop-blur-xl transition-all duration-300"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    {item.title}
                  </p>

                  <h2 className="mt-3 text-4xl font-black text-slate-900">
                    {item.value}
                  </h2>
                </div>

                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-300/30">
                  <Icon size={24} className="text-white" />
                </div>
              </div>

              <div className="mt-5 h-1 w-0 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-500 group-hover:w-full" />
            </motion.div>
          );
        })}
      </div>

      {/* CONTENT GRID */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* RECENT APPLICATIONS */}
        <div className="xl:col-span-2">
          <div className="rounded-[32px] border border-white bg-white/80 p-6 shadow-xl shadow-slate-200/40 backdrop-blur-xl">
            {/* HEADER */}
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-900">
                  Recent Applications
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Recently assigned loan applications
                </p>
              </div>

              <button className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200">
                View All
              </button>
            </div>

            {/* TABLE */}
            <div className="overflow-hidden rounded-2xl border border-slate-100">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                      Application
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                      Borrower
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                      Amount
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {recentApplications.map((item) => (
                    <tr
                      key={item.id}
                      className="border-t border-slate-100 transition hover:bg-slate-50"
                    >
                      <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                        {item.id}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {item.borrower}
                      </td>

                      <td className="px-5 py-4 text-sm font-medium text-slate-700">
                        {item.amount}
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-700">
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

        {/* PENDING TASKS */}
        <div>
          <div className="rounded-[32px] border border-white bg-white/80 p-6 shadow-xl shadow-slate-200/40 backdrop-blur-xl">
            <div className="mb-6">
              <h2 className="text-2xl font-black text-slate-900">
                Pending Tasks
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Tasks requiring attention
              </p>
            </div>

            <div className="space-y-4">
              {[
                "Upload borrower bank statements",
                "Review lender LOI response",
                "Submit pending property documents",
                "Reply to broker message",
              ].map((task, index) => (
                <motion.div
                  key={task}
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    delay: index * 0.1,
                  }}
                  className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 transition hover:bg-slate-100"
                >
                  <div className="mt-1 h-3 w-3 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600" />

                  <p className="text-sm leading-6 text-slate-700">{task}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
