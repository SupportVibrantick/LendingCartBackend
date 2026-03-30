import { useEffect, useState } from "react";
import { ChevronDown, Settings } from "lucide-react";

const fields = [
  { label: "Min Loan Amount ($)", key: "minLoan" },
  { label: "Max Loan Amount ($)", key: "maxLoan" },
  { label: "Min Rate (%)", key: "minRate" },
  { label: "Max Rate (%)", key: "maxRate" },
  { label: "Max LTV (%)", key: "maxLtv" },
  { label: "Max LTC (%)", key: "maxLtc" },
  { label: "Min FICO Score", key: "fico" },
  { label: "Min Term (months)", key: "minTerm" },
  { label: "Max Term (months)", key: "maxTerm" },
  { label: "Origination Points (%)", key: "points" },
];

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

const StepFive = ({ products, value, setValue, setHasErrors }: any) => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [errors, setErrors] = useState<any>({});

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

    // validation
    setErrors((prev: any) => ({
      ...prev,
      [productId]: {
        ...prev?.[productId],
        states: updatedStates.length === 0 ? "Select at least one state" : "",
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
        states: "Select at least one state",
      },
    }));
  };

  const validateField = (productId: string, key: string, val: any) => {
    let error = "";

    if (!val && val !== 0) {
      error = "Required";
    }

    const current = value?.[productId] || {}; // ✅ correct usage

    // Min-Max validation
    if (
      key === "minLoan" &&
      current.maxLoan &&
      Number(val) > Number(current.maxLoan)
    ) {
      error = "Min > Max";
    }

    if (
      key === "maxLoan" &&
      current.minLoan &&
      Number(val) < Number(current.minLoan)
    ) {
      error = "Max < Min";
    }

    if (
      key === "minRate" &&
      current.maxRate &&
      Number(val) > Number(current.maxRate)
    ) {
      error = "Min > Max";
    }

    if (
      key === "maxRate" &&
      current.minRate &&
      Number(val) < Number(current.minRate)
    ) {
      error = "Max < Min";
    }

    if (
      key === "minTerm" &&
      current.maxTerm &&
      Number(val) > Number(current.maxTerm)
    ) {
      error = "Min > Max";
    }

    if (
      key === "maxTerm" &&
      current.minTerm &&
      Number(val) < Number(current.minTerm)
    ) {
      error = "Max < Min";
    }

    return error;
  };

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
            states: "Select at least one state",
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
                  {fields.map((field) => (
                    <div key={field.key}>
                      <label className="text-xs text-gray-600 mb-1 block">
                        {field.label} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={value?.[product.id]?.[field.key] || ""}
                        onChange={(e) => {
                          const val = e.target.value;

                          handleChange(product.id, field.key, val);

                          const err = validateField(product.id, field.key, val);

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
                  ))}
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
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default StepFive;
