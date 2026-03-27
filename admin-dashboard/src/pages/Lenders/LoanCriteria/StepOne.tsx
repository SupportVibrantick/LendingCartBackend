const StepOne = ({ form, setForm }: any) => {
  const handle = (key: string, value: any) => {
    setForm((prev: any) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
      {/* Heading */}
      <div className="mb-5">
       <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          🏢 Company Information
        </h2>
      </div>

      {/* Form */}
      <div className="grid grid-cols-2 gap-4">
        {/* Company Name */}
        <div>
          <label className="text-sm font-medium text-gray-700">
            Company Name <span className="text-red-500">*</span>
          </label>
          <input
            placeholder="Enter company name"
            value={form.companyName}
            onChange={(e) => handle("companyName", e.target.value)}
           className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 focus:ring-2 focus:ring-black focus:border-black outline-none transition"
          />
        </div>

        {/* Lender Type */}
        <div>
          <label className="text-sm font-medium text-gray-700">Lender Type</label>
          <select
            value={form.lenderType}
            onChange={(e) => handle("lenderType", e.target.value)}
           className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 focus:ring-2 focus:ring-black focus:border-black outline-none transition"
          >
            <option value="">Select lender type</option>
            <option>Bank</option>
            <option>NBFC</option>
            <option>Private</option>
          </select>
        </div>

        {/* Contact Name */}
        <div>
          <label className="text-sm font-medium text-gray-700">Contact Name</label>
          <input
            placeholder="Primary contact"
            value={form.contactName}
            onChange={(e) => handle("contactName", e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 focus:ring-2 focus:ring-black focus:border-black outline-none transition"
          />
        </div>

        {/* Contact Email */}
        <div>
          <label className="text-sm font-medium text-gray-700">
            Contact Email <span className="text-red-500">*</span>
          </label>
          <input
            placeholder="email@company.com"
            value={form.contactEmail}
            onChange={(e) => handle("contactEmail", e.target.value)}
           className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 focus:ring-2 focus:ring-black focus:border-black outline-none transition"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="text-sm font-medium text-gray-700">Phone</label>
          <input
            placeholder="(555) 000-0000"
            value={form.phone}
            onChange={(e) => handle("phone", e.target.value)}
           className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 focus:ring-2 focus:ring-black focus:border-black outline-none transition"
          />
        </div>

        {/* Website */}
        <div>
          <label className="text-sm font-medium text-gray-700">Website</label>
          <input
            placeholder="https://company.com"
            value={form.website}
            onChange={(e) => handle("website", e.target.value)}
           className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 focus:ring-2 focus:ring-black focus:border-black outline-none transition"
          />
        </div>

        {/* NMLS */}
        <div>
          <label className="text-sm font-medium text-gray-700">NMLS Number</label>
          <input
            placeholder="NMLS #"
            value={form.nmls}
            onChange={(e) => handle("nmls", e.target.value)}
           className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 focus:ring-2 focus:ring-black focus:border-black outline-none transition"
          />
        </div>

        {/* Address */}
        <div>
          <label className="text-sm font-medium text-gray-700">Address</label>
          <input
            placeholder="Street address"
            value={form.address}
            onChange={(e) => handle("address", e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 focus:ring-2 focus:ring-black focus:border-black outline-none transition"
          />
        </div>

        {/* City */}
        <div>
          <label className="text-sm font-medium text-gray-700">City</label>
          <input
            value={form.city}
            onChange={(e) => handle("city", e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 focus:ring-2 focus:ring-black focus:border-black outline-none transition"
          />
        </div>

        {/* State */}
        <div>
          <label className="text-sm font-medium text-gray-700">State</label>
          <input
            placeholder="e.g. CA"
            value={form.state}
            onChange={(e) => handle("state", e.target.value)}
           className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 focus:ring-2 focus:ring-black focus:border-black outline-none transition"
          />
        </div>

        {/* ZIP */}
        <div>
          <label className="text-sm font-medium text-gray-700">ZIP</label>
          <input
            value={form.zip}
            onChange={(e) => handle("zip", e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 focus:ring-2 focus:ring-black focus:border-black outline-none transition"
          />
        </div>

        {/* Active Status */}
        <div className="flex items-center justify-between border rounded-lg px-4 py-3">
          <div>
            <p className="text-sm font-medium">Active Status</p>
            <p className="text-xs text-blue-600">
              Is this lender currently active?
            </p>
          </div>

          <button
            onClick={() => handle("isActive", !form.isActive)}
            className={`w-12 h-6 flex items-center p-1 rounded-full ${
              form.isActive ? "bg-black" : "bg-gray-300"
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full transition ${
                form.isActive ? "translate-x-6" : ""
              }`}
            />
          </button>
        </div>

        {/* Notes */}
        <div className="col-span-2">
          <label className="text-sm font-medium text-gray-700">Notes</label>
          <textarea
            rows={4}
            placeholder="Internal notes about this lender..."
            value={form.notes}
            onChange={(e) => handle("notes", e.target.value)}
         className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 focus:ring-2 focus:ring-black focus:border-black outline-none transition"
          />
        </div>
      </div>
    </div>
  );
};

export default StepOne;
