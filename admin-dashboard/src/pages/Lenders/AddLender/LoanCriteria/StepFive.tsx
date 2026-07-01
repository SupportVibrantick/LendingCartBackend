import { useEffect, useState } from "react";
import { ChevronDown, Settings, FileText, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  getCriteriaFieldsForProduct,
  type CriteriaField,
} from "../../../../lib/loanProductCriteriaFields";

const US_STATES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
];

const API_BASE =
  import.meta.env.VITE_API_BASE || "https://api-lendingcart.vibrantick.org";

const getColor = (name: string) => {
  const colors = [
    "bg-orange-500",
    "bg-green-500",
    "bg-blue-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-yellow-500",
    "bg-indigo-500",
    "bg-teal-500",
    "bg-red-500",
    "bg-cyan-500",
  ];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
};

type StepFiveProps = {
  products: any[];
  value: Record<string, any>;
  setValue: (val: Record<string, any>) => void;
  setHasErrors?: (hasErrors: boolean) => void;
  authMode?: "admin" | "lender";
};

const StepFive = ({
  products,
  value,
  setValue,
  setHasErrors,
  authMode = "admin",
}: StepFiveProps) => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [errors, setErrors] = useState<any>({});
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  const fetchDocuments = async () => {
    try {
      setLoadingDocs(true);

      const tokenKey = authMode === "admin" ? "admin_token" : "lender_token";
      const token = sessionStorage.getItem(tokenKey);

      const endpoint =
        authMode === "admin"
          ? `${API_BASE}/admin/document-types/read?isActive=true&limit=200`
          : `${API_BASE}/document-types/active`;

      const res = await fetch(endpoint, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token && {
            Authorization: `Bearer ${token}`,
          }),
        },
      });

      const json = await res.json();

      if (json?.success) {
        setDocuments(json.data || []);
      }
    } catch (err) {
      console.error("Failed to load documents", err);
      toast.error("Failed to load documents");
    } finally {
      setLoadingDocs(false);
    }
  };

  const toggleDocument = (productId: string, doc: any) => {
    const currentDocs = value?.[productId]?.documents || [];

    const exists = currentDocs.some(
      (d: any) => d.id === doc.id || d.documentTypeId === doc.id,
    );

    const updated = exists
      ? currentDocs.filter(
          (d: any) => d.id !== doc.id && d.documentTypeId !== doc.id,
        )
      : [...currentDocs, doc];

    handleChange(productId, "documents", updated);
  };

  const selectAllDocuments = (productId: string) => {
    handleChange(productId, "documents", documents);
  };

  const clearDocuments = (productId: string) => {
    handleChange(productId, "documents", []);
  };

  const handleChange = (productId: string, key: string, val: any) => {
    const current = value || {};

    const updated = {
      ...current,
      [productId]: {
        ...current?.[productId],
        [key]: val,
      },
    };

    setValue(updated);
  };

  const toggleState = (productId: string, state: string) => {
    const currentStates = value?.[productId]?.states || [];

    const updatedStates = currentStates.includes(state)
      ? currentStates.filter((s: string) => s !== state)
      : [...currentStates, state];

    handleChange(productId, "states", updatedStates);

    // IMPORTANT: validation
    setErrors((prev: any) => ({
      ...prev,
      [productId]: {
        ...prev?.[productId],
        states:
          updatedStates.length === 0
            ? "Please select at least one state where lending is available"
            : "",
      },
    }));
  };

  const selectAllStates = (productId: string) => {
    handleChange(productId, "states", US_STATES);

    setErrors((prev: any) => ({
      ...prev,
      [productId]: {
        ...prev?.[productId],
        states: "",
      },
    }));
  };

  const clearStates = (productId: string) => {
    handleChange(productId, "states", []);

    setErrors((prev: any) => ({
      ...prev,
      [productId]: {
        ...prev?.[productId],
        states: "Please select at least one state where lending is available",
      },
    }));
  };

  const validateField = (
    productId: string,
    key: string,
    val: any,
    options?: { required?: boolean },
  ) => {
    const current = value?.[productId] || {};
    const isRequired = options?.required !== false;

    // ✅ EMPTY CHECK
    if (val === "" || val === null || val === undefined) {
      return isRequired ? "This field is required" : "";
    }

    const numVal = Number(val);

    // ✅ GENERIC NUMBER VALIDATION
    if (numVal < 0) {
      return "Value cannot be negative";
    }

    // ✅ LOAN AMOUNT
    if (key === "minLoan" && current.maxLoan) {
      if (numVal > Number(current.maxLoan)) {
        return "Minimum loan amount cannot exceed maximum loan amount";
      }
    }

    if (key === "maxLoan" && current.minLoan) {
      if (numVal < Number(current.minLoan)) {
        return "Maximum loan amount cannot be less than minimum loan amount";
      }
    }

    if (key === "minFacilitySize" && current.maxFacilitySize) {
      if (numVal > Number(current.maxFacilitySize)) {
        return "Minimum facility size cannot exceed maximum facility size";
      }
    }

    if (key === "maxFacilitySize" && current.minFacilitySize) {
      if (numVal < Number(current.minFacilitySize)) {
        return "Maximum facility size cannot be less than minimum facility size";
      }
    }

    if (key === "minProgramSize" && current.maxProgramSize) {
      if (numVal > Number(current.maxProgramSize)) {
        return "Minimum program size cannot exceed maximum program size";
      }
    }

    if (key === "maxProgramSize" && current.minProgramSize) {
      if (numVal < Number(current.minProgramSize)) {
        return "Maximum program size cannot be less than minimum program size";
      }
    }

    if (key === "minProperties" && current.maxProperties) {
      if (numVal > Number(current.maxProperties)) {
        return "Minimum properties cannot exceed maximum properties";
      }
    }

    if (key === "maxProperties" && current.minProperties) {
      if (numVal < Number(current.minProperties)) {
        return "Maximum properties cannot be less than minimum properties";
      }
    }

    // ✅ INTEREST RATE
    if (key === "minRate" && current.maxRate) {
      if (numVal > Number(current.maxRate)) {
        return "Minimum interest rate cannot exceed maximum rate";
      }
    }

    if (key === "maxRate" && current.minRate) {
      if (numVal < Number(current.minRate)) {
        return "Maximum interest rate cannot be less than minimum rate";
      }
    }

    // ✅ TERM
    if (key === "minTerm" && current.maxTerm) {
      if (numVal > Number(current.maxTerm)) {
        return "Minimum term cannot exceed maximum term";
      }
    }

    if (key === "maxTerm" && current.minTerm) {
      if (numVal < Number(current.minTerm)) {
        return "Maximum term cannot be less than minimum term";
      }
    }

    if (
      key === "maxLtv" ||
      key === "maxArv" ||
      key === "maxLtc" ||
      key === "mezzLtvMin" ||
      key === "mezzLtvMax"
    ) {
      if (numVal > 100) {
        if (key === "maxLtv") {
          return "LTV cannot exceed 100%";
        }

        if (key === "maxArv") {
          return "ARV cannot exceed 100%";
        }

        if (key === "maxLtc") {
          return "LTC cannot exceed 100%";
        }

        if (key === "mezzLtvMin" || key === "mezzLtvMax") {
          return "Mezz LTV cannot exceed 100%";
        }
      }
    }

    if (key === "mezzLtvMin" && current.mezzLtvMax) {
      if (numVal > Number(current.mezzLtvMax)) {
        return "Mezz LTV min cannot exceed max";
      }
    }

    if (key === "mezzLtvMax" && current.mezzLtvMin) {
      if (numVal < Number(current.mezzLtvMin)) {
        return "Mezz LTV max cannot be less than min";
      }
    }

    if (key === "maxRateSpread" && numVal > 100) {
      return "Max rate spread cannot exceed 100%";
    }

    if (key === "requiredInjection" && numVal > 100) {
      return "Required injection cannot exceed 100%";
    }

    if (key === "minTimeInBusiness" && (numVal < 0 || numVal > 600)) {
      return "Min time in business must be between 0 and 600 months";
    }

    if (key === "usdaGuaranteePercent" && numVal > 100) {
      return "USDA guarantee cannot exceed 100%";
    }

    if (
      (key === "advanceRate" ||
        key === "transactionFee" ||
        key === "minGrossMargin" ||
        key === "discountFee" ||
        key === "earlyPaymentDiscount") &&
      numVal > 100
    ) {
      return "Percentage cannot exceed 100%";
    }

    if (key === "maxInvoiceAgeDays" && (numVal <= 0 || numVal > 365)) {
      return "Max invoice age must be between 1 and 365 days";
    }

    if (
      key === "paymentTermsExtensionDays" &&
      (numVal <= 0 || numVal > 365)
    ) {
      return "Payment terms extension must be between 1 and 365 days";
    }

    if (key === "avgTurnaroundDays" && (numVal <= 0 || numVal > 365)) {
      return "Avg turnaround must be between 1 and 365 days";
    }

    if (key === "preferredReturn" && numVal > 100) {
      return "Preferred return cannot exceed 100%";
    }

    if (key === "exitFee" && numVal > 100) {
      return "Exit fee cannot exceed 100%";
    }

    if (key === "fico") {
      if (numVal < 300 || numVal > 900) {
        return "FICO score must be between 300 and 900";
      }
    }

    if (key === "experience") {
      if (numVal > 100) {
        return "Experience seems too high";
      }
    }

    if (key === "originationPoints" && numVal > 100) {
      return "Origination points cannot exceed 100%";
    }

    if (key === "minDscr") {
      if (numVal <= 0 || numVal > 10) {
        return "Min DSCR must be between 0 and 10";
      }
    }

    if (key === "minDebtYield" && numVal > 100) {
      return "Min debt yield cannot exceed 100%";
    }

    if (key === "amortizationYears" && (numVal <= 0 || numVal > 50)) {
      return "Amortization must be between 1 and 50 years";
    }

    if (key === "minUnits" && (numVal <= 0 || numVal > 10000)) {
      return "Min units must be a positive number";
    }

    return "";
  };

  const renderField = (product: any, field: CriteriaField) => {
    const fieldType = field.type || "number";
    const currentValue = value?.[product.id]?.[field.key];
    const isRequired = field.required !== false && fieldType !== "toggle";

    if (fieldType === "toggle") {
      return (
        <div key={field.key} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-3">
          <label className="text-xs text-gray-700 font-medium">{field.label}</label>
          <button
            type="button"
            onClick={() =>
              handleChange(product.id, field.key, !Boolean(currentValue))
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
              currentValue ? "bg-blue-600" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                currentValue ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      );
    }

    if (fieldType === "textarea") {
      return (
        <div key={field.key} className="col-span-2">
          <label className="text-xs text-gray-600 mb-1 block">{field.label}</label>
          <textarea
            value={currentValue || ""}
            onChange={(e) => handleChange(product.id, field.key, e.target.value)}
            rows={4}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      );
    }

    if (fieldType === "text") {
      return (
        <div key={field.key} className="col-span-2">
          <label className="text-xs text-gray-600 mb-1 block">
            {field.label}
            {isRequired && <span className="text-red-500"> *</span>}
          </label>
          <input
            type="text"
            value={currentValue || ""}
            onChange={(e) => handleChange(product.id, field.key, e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      );
    }

    return (
      <div key={field.key}>
        <label className="text-xs text-gray-600 mb-1 block">
          {field.label}
          {isRequired && <span className="text-red-500"> *</span>}
        </label>
        <input
          type="number"
          step={field.decimal ? "0.01" : "1"}
          value={currentValue || ""}
          onChange={(e) => {
            const val = e.target.value;
            const err = validateField(product.id, field.key, val, {
              required: field.required !== false,
            });

            handleChange(product.id, field.key, val);

            setErrors((prev: any) => ({
              ...prev,
              [product.id]: {
                ...prev?.[product.id],
                [field.key]: err,
              },
            }));
          }}
          className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2
  ${
    errors?.[product.id]?.[field.key]
      ? "border-red-500 focus:ring-red-500"
      : "border-gray-300 focus:ring-blue-500"
  }`}
        />
        {errors?.[product.id]?.[field.key] && (
          <p className="text-xs text-red-500 mt-1">
            {errors[product.id][field.key]}
          </p>
        )}
      </div>
    );
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  useEffect(() => {
    const hasErr = Object.values(errors).some((product: any) =>
      Object.values(product || {}).some((e) => !!e),
    );

    setHasErrors?.(hasErr);
  }, [errors]);

  useEffect(() => {
    products.forEach((p: any) => {
      if (!value?.[p.id]?.states?.length) {
        setErrors((prev: any) => ({
          ...prev,
          [p.id]: {
            ...prev?.[p.id],
            states:
              "Please select at least one state where lending is available",
          },
        }));
      }
    });
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Settings size={14} /> Loan Criteria
        </h2>
        <p className="text-sm text-gray-500">
          Configure lending criteria for each selected loan program. 
        </p>
      </div>

      {/* List */}
      {products.map((product: any, index: number) => {
        const isOpen = openIndex === index;

        return (
          <div
            key={product.id}
            className="border rounded-xl overflow-hidden transition"
          >
            {/* Header Row */}
            <div
              onClick={() => setOpenIndex(isOpen ? null : index)}
              className="flex justify-between items-center px-4 py-3 cursor-pointer bg-white hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${getColor(
                    product.name,
                  )} ring-2 ring-white shadow-sm`}
                />
                <span className="font-medium text-sm">{product.name}</span>
              </div>

              <ChevronDown
                size={16}
                className={`transition ${isOpen ? "rotate-180" : ""}`}
              />
            </div>

            {/* Form */}
            {isOpen && (
              <div className="p-4 bg-gray-50 border-t">
                <div className="grid grid-cols-2 gap-4">
                  {getCriteriaFieldsForProduct(product.code).map((field) =>
                    renderField(product, field),
                  )}
                </div>
                {/* STATES SECTION */}
                <div className="mt-6">
                  {/* Header */}
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-semibold">States</h3>

                    <div className="flex gap-3 text-xs">
                      <button
                        onClick={() => selectAllStates(product.id)}
                        className="text-blue-600 font-medium hover:underline"
                      >
                        Select All
                      </button>

                      <button
                        onClick={() => clearStates(product.id)}
                        className="text-red-500 font-medium hover:underline"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  {/* States Container */}
                  <div
                    className={`border rounded-xl p-3 max-h-44 overflow-y-auto bg-white
  ${errors?.[product.id]?.states ? "border-red-500" : "border-gray-300"}`}
                  >
                    <div className="grid grid-cols-4 gap-2">
                      {US_STATES.map((state) => {
                        const selected =
                          value?.[product.id]?.states?.includes(state);

                        return (
                          <label
                            key={state}
                            className={`flex items-center gap-2 text-xs px-2 py-1 rounded cursor-pointer transition
              ${selected ? "bg-blue-50 text-blue-600" : "hover:bg-gray-50"}`}
                          >
                            <input
                              type="checkbox"
                              checked={selected || false}
                              onChange={() => toggleState(product.id, state)}
                              className="accent-blue-600 cursor-pointer"
                            />
                            {state}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Selected Count */}
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-xs text-gray-500">
                      {value?.[product.id]?.states?.length || 0} states selected
                    </p>
                  </div>
                </div>
                {errors?.[product.id]?.states && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors[product.id].states}
                  </p>
                )}

                {/* DOCUMENTS */}
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-indigo-600" />

                      <h3 className="text-sm font-semibold">
                        What documents do you need in this program? (optional)
                      </h3>

                      {!!value?.[product.id]?.documents?.length && (
                        <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">
                          {value?.[product.id]?.documents?.length} selected
                        </span>
                      )}
                    </div>

                    <div className="flex gap-3 text-xs">
                      <button
                        type="button"
                        onClick={() => selectAllDocuments(product.id)}
                        className="text-indigo-600 font-medium hover:underline"
                      >
                        Select All
                      </button>

                      <button
                        type="button"
                        onClick={() => clearDocuments(product.id)}
                        className="text-red-500 font-medium hover:underline"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  {loadingDocs ? (
                    <div className="text-sm text-gray-400">
                      Loading documents...
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {documents.map((doc) => {
                        const checked = value?.[product.id]?.documents?.some(
                          (d: any) =>
                            d.id === doc.id || d.documentTypeId === doc.id,
                        );

                        return (
                          <label
                            key={doc.id}
                            className={`group relative flex items-start gap-3 rounded-2xl border px-4 py-3 cursor-pointer transition-all duration-200
            ${
              checked
                ? "border-indigo-500 bg-indigo-50 shadow-sm scale-[1.01]"
                : "border-gray-200 bg-white hover:border-indigo-300 hover:bg-gray-50"
            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked || false}
                              onChange={() => toggleDocument(product.id, doc)}
                              className="mt-1 accent-indigo-600 cursor-pointer"
                            />

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-2.5 h-2.5 rounded-full ${getColor(
                                    doc.name,
                                  )}`}
                                />

                                <p className="text-sm font-medium text-gray-800 leading-tight">
                                  {doc.name}
                                </p>
                              </div>

                              {/* {doc.code && (
                                <p className="text-[11px] text-gray-500 mt-1 uppercase tracking-wide">
                                  {doc.code}
                                </p>
                              )} */}
                            </div>

                            {checked && (
                              <CheckCircle2
                                size={18}
                                className="text-indigo-600 shrink-0"
                              />
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default StepFive;
