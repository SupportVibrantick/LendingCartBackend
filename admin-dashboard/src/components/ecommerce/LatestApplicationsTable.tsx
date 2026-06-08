import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface Props {
  applications: any[];
}

export default function LatestApplicationsTable({ applications }: Props) {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 5;

  const filteredApplications = useMemo(() => {
    if (!search) return applications;

    return applications.filter((app) =>
      [
        app.applicationNumber,
        app.clientName,
        app.brokerName,
        app.product,
        app.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  }, [applications, search]);

  const totalPages = Math.ceil(filteredApplications.length / rowsPerPage);

  const paginatedApplications = filteredApplications.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage,
  );

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "LENDER_APPROVED":
        return "bg-emerald-100 text-emerald-700";
      case "LENDER_DECLINED":
        return "bg-rose-100 text-rose-700";
      case "IN_REVIEW":
        return "bg-indigo-100 text-indigo-700";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  const formatProduct = (product?: string | null) =>
    (product || "—").replace(/_/g, " ");

  const formatAmount = (amount?: number | string | null) => {
    if (amount == null || amount === "") return "—";
    const value = Number(amount);
    if (Number.isNaN(value) || value <= 0) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatLenders = (app: any) => {
    const count = app.lenderCount ?? 0;
    const names = app.lenderNames as string[] | undefined;

    if (count > 0 && names?.length) {
      return names.length === 1 ? names[0] : `${count} lenders`;
    }

    return count > 0 ? String(count) : "—";
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0F172A]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800 gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Latest Applications
          </h3>
          <p className="text-sm text-slate-500">
            Recently submitted loan requests
          </p>
        </div>

        {/* 🔎 Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-4" />
          <input
            type="text"
            placeholder="Search applications..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400">
            <tr>
              <th className="px-6 py-3 font-medium">Application</th>
              <th className="px-6 py-3 font-medium">Broker</th>
              <th className="px-6 py-3 font-medium">Client</th>
              <th className="px-6 py-3 font-medium">Product</th>
              <th className="px-6 py-3 font-medium">Lenders</th>
              <th className="px-6 py-3 font-medium">Amount</th>
              <th className="px-6 py-3 font-medium">Date</th>
              <th className="px-6 py-3 font-medium">Status</th>
            </tr>
          </thead>

          <tbody>
            {paginatedApplications.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <div className="flex flex-col items-center justify-center py-14 text-center">
                    {/* Icon */}
                    <div
                      className="flex items-center justify-center w-10 h-10 rounded-2xl 
        bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg mb-4"
                    >
                      <Search className="text-white w-6 h-6" />
                    </div>

                    {/* Title */}
                    <h4 className="text-base font-semibold text-slate-900 dark:text-white">
                      No Applications Found
                    </h4>

                    {/* Description */}
                    <p className="mt-1 text-sm text-slate-500 max-w-sm">
                      We couldn't find any applications matching your search.
                      Try adjusting your filters.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedApplications.map((app) => (
                <tr
                  key={app.id}
                  className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition"
                >
                  <td className="px-6 py-4 text-xs font-medium text-slate-900 dark:text-white">
                    {app.applicationNumber}
                  </td>

                  <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-300">
                    {app.brokerName}
                  </td>

                  <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-300">
                    {app.clientName || "—"}
                  </td>

                  <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-300">
                    {formatProduct(app.product)}
                  </td>

                  <td
                    className="px-6 py-4 text-xs text-slate-600 dark:text-slate-300"
                    title={
                      app.lenderNames?.length
                        ? app.lenderNames.join(", ")
                        : undefined
                    }
                  >
                    {formatLenders(app)}
                  </td>

                  <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-300">
                    {formatAmount(app.amount)}
                  </td>

                  <td className="px-6 py-4 text-xs text-slate-500">
                    {formatDate(app.createdAt)}
                  </td>

                  <td className="px-6 py-4">
                    <span
                      className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusStyle(
                        app.status,
                      )}`}
                    >
                      {formatProduct(app.status)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {filteredApplications.length > 0 && (
        <div
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-6 py-4 
    border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A]"
        >
          {/* Summary */}
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Showing{" "}
            <span className="font-semibold text-slate-800 dark:text-white">
              {(currentPage - 1) * rowsPerPage + 1}
            </span>{" "}
            to{" "}
            <span className="font-semibold text-slate-800 dark:text-white">
              {Math.min(currentPage * rowsPerPage, filteredApplications.length)}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-slate-800 dark:text-white">
              {filteredApplications.length}
            </span>{" "}
            results
          </p>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Previous */}
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm rounded-lg border 
        border-slate-300 text-slate-700 hover:bg-slate-100 
        disabled:opacity-40 disabled:cursor-not-allowed
        dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800 transition"
            >
              Prev
            </button>

            {/* Page Numbers */}
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-1.5 text-sm rounded-lg transition ${
                  currentPage === page
                    ? "bg-indigo-600 text-white shadow-md dark:bg-indigo-500"
                    : "border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                {page}
              </button>
            ))}

            {/* Next */}
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm rounded-lg border 
        border-slate-300 text-slate-700 hover:bg-slate-100 
        disabled:opacity-40 disabled:cursor-not-allowed
        dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800 transition"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
