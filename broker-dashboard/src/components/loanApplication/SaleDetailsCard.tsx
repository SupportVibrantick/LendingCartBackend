type SaleDetailsCardProps = {
  privateSale: boolean;
  vendorName: string;
  vendorPhone: string;
  onPrivateSaleChange: (value: boolean) => void;
  onVendorNameChange: (value: string) => void;
  onVendorPhoneChange: (value: string) => void;
  formatUSPhone: (value: string) => string;
};

/**
 * Sale Details card for the Collateral step. Shown for SBA/USDA + ABL
 * products. Captures a private-sale flag plus equipment vendor name & phone.
 */
export default function SaleDetailsCard({
  privateSale,
  vendorName,
  vendorPhone,
  onPrivateSaleChange,
  onVendorNameChange,
  onVendorPhoneChange,
  formatUSPhone,
}: SaleDetailsCardProps) {
  return (
    <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-900/40">
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
        Sale Details
      </p>

      <div className="mt-3 flex items-center justify-between rounded-md border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
          Private Sale?
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={privateSale}
          onClick={() => onPrivateSaleChange(!privateSale)}
          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition ${
            privateSale
              ? "bg-[#2C92D5]"
              : "bg-slate-200 dark:bg-slate-700"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
              privateSale ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Equipment Vendor / Dealer / Seller
          </label>
          <input
            type="text"
            value={vendorName}
            onChange={(e) => onVendorNameChange(e.target.value)}
            placeholder="Vendor / Dealer / Seller name"
            className="mt-1 w-full rounded-md border border-slate-300 px-4 py-1 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Vendor / Dealer / Seller Phone
          </label>
          <input
            type="tel"
            inputMode="numeric"
            value={vendorPhone}
            onChange={(e) => onVendorPhoneChange(formatUSPhone(e.target.value))}
            placeholder="Phone number"
            className="mt-1 w-full rounded-md border border-slate-300 px-4 py-1 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
          />
        </div>
      </div>
    </div>
  );
}
