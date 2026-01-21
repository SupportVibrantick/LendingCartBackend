import { useState } from "react";

export default function GetLoanPage() {
  const [isBroker, setIsBroker] = useState<null | boolean>(null);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12">
      <div className="max-w-5xl mx-auto px-4">
        {/* Heading */}
        <h1 className="text-sm font-semibold text-blue-700 dark:text-blue-400 mb-6">
          This is our quick app to help us determine eligibility, available loan
          options & structure various loan terms for you.
        </h1>

        {/* Card */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow border border-slate-200 dark:border-slate-800">
          {/* Section Header */}
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 font-semibold text-sm flex items-center justify-between text-slate-800 dark:text-white">
            <span>Loan Officer / Broker</span>
            <span className="text-blue-600 dark:text-blue-400">ⓘ</span>
          </div>

          <div className="p-6 space-y-6">
            {/* Question */}
            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg flex items-center justify-between border border-slate-200 dark:border-slate-700">
              <span className="font-medium text-sm text-slate-800 dark:text-slate-200">
                Are you a Mortgage Broker OR working WITH ONE?
              </span>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="radio"
                    name="isBroker"
                    checked={isBroker === true}
                    onChange={() => setIsBroker(true)}
                  />
                  Yes
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="radio"
                    name="isBroker"
                    checked={isBroker === false}
                    onChange={() => setIsBroker(false)}
                  />
                  No
                </label>
              </div>
            </div>

            {/* ================= IF YES → SHOW FORM ================= */}
            {isBroker === true && (
              <div className="space-y-6">
                {/* Row 1 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Email Address" />
                  <Input label="Phone Number" placeholder="(___) ___-____" />
                </div>

                {/* Row 2 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="First Name" />
                  <Input label="Last Name" />
                </div>

                {/* Row 3 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Company Name" />
                  <Input label="NMLS ID" />
                </div>

                {/* Divider */}
                <div className="h-px bg-slate-200 dark:bg-slate-700" />

                {/* Dropdowns */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select label="What kind of program are you looking for?" />
                  <Select label="Where are you in the process?" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select label="Lead Source" />
                </div>

                {/* Submit */}
                <div className="pt-4">
                  <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold text-sm shadow">
                    Continue Application
                  </button>
                </div>
              </div>
            )}

            {/* ================= IF NO ================= */}
            {isBroker === false && (
              <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300 text-sm">
                Please ask your Mortgage Broker to submit this application for
                you.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================== Small Reusable Components ================== */

function Input({
  label,
  placeholder = "",
}: {
  label: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      <input
        placeholder={placeholder}
        className="text-sm mt-1 w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

function Select({ label }: { label: string }) {
  return (
    <div>
      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      <select className="mt-1 w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
        <option>- Select -</option>
      </select>
    </div>
  );
}
