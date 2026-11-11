type SaleDetailsCardProps = {
  privateSale: boolean;
  vendorName: string;
  vendorPhone: string;
  onPrivateSaleChange: (value: boolean) => void;
  onVendorNameChange: (value: string) => void;
  onVendorPhoneChange: (value: string) => void;
  formatUSPhone: (value: string) => string;
  /** Equipment Finance keeps vendor/dealer wording; all other programs use Seller. */
  isEquipmentFinance?: boolean;
};

/**
 * Sale Details card for the Property Info step.
 * Captures a private-sale flag plus seller (or equipment vendor) name & phone.
 */
export default function SaleDetailsCard({
  privateSale,
  vendorName,
  vendorPhone,
  onPrivateSaleChange,
  onVendorNameChange,
  onVendorPhoneChange,
  formatUSPhone,
  isEquipmentFinance = false,
}: SaleDetailsCardProps) {
  const nameLabel = isEquipmentFinance
    ? "Equipment Vendor / Dealer / Seller"
    : "Seller";
  const namePlaceholder = isEquipmentFinance
    ? "Vendor / Dealer / Seller name"
    : "Seller name";
  const phoneLabel = isEquipmentFinance
    ? "Vendor / Dealer / Seller Phone"
    : "Seller Phone";

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
              ? "bg-[#13538A]"
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
            {nameLabel}
          </label>
          <input
            type="text"
            value={vendorName}
            onChange={(e) => onVendorNameChange(e.target.value)}
            placeholder={namePlaceholder}
            className="mt-1 w-full rounded-md border border-slate-300 px-4 py-1 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
            {phoneLabel}
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
