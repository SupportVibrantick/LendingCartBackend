import { MapPin, ChevronDown, CheckCircle } from "lucide-react";
import { useState } from "react";

const data = [
  {
    name: "Multifamily",
    subTypes: [
      "Garden (Low-rise)",
      "Mid-Rise (4-8 stories)",
      "High-Rise (9+ stories)",
      "Senior Housing (55+)",
      "Student Housing",
      "Affordable Housing (LIHTC)",
    ],
  },
  {
    name: "Mixed-Use",
    subTypes: [
      "Horizontal (Side-by-side)",
      "Vertical (Ground floor retail)",
      "Live & Work",
    ],
  },
  {
    name: "Office",
    subTypes: [
      "Central Business District",
      "Medical (MOB)",
      "Creative / Loft",
      "Government",
      "Suburban / Office Park",
    ],
  },
  {
    name: "Retail",
    subTypes: [
      "Strip Plaza",
      "Mall / Regional",
      "Single-Tenant NNN",
      "Restaurant / Food Service",
      "Automotive",
    ],
  },
  {
    name: "Industrial",
    subTypes: [
      "Warehouse / Distribution",
      "Manufacturing",
      "Flex Space",
      "Data Center",
      "Cold Storage",
    ],
  },
  {
    name: "Special Purpose",
    subTypes: [
      "Car Wash",
      "Gas Station / C-Store",
      "Self Storage",
      "Hospital / Medical",
      "School / Education",
      "Sports Complex",
    ],
  },
  {
    name: "Land",
    subTypes: [
      "Raw (Undeveloped)",
      "Entitled (Approved)",
      "Developed (Improved)",
      "Agriculture",
    ],
  },
  {
    name: "Hospitality",
    subTypes: [
      "Full-Service Hotel",
      "Limited-Service Hotel",
      "Extended Stay",
      "Boutique Hotel",
      "Motel",
    ],
  },
  {
    name: "Single Family (1-4 Units)",
    subTypes: [
      "Single Family Detached",
      "Duplex",
      "Triplex",
      "Fourplex",
      "Condo / Townhome",
    ],
  },
  {
    name: "Mobile Home Park",
    subTypes: [],
  },
  {
    name: "NNN Lease",
    subTypes: ["Single Tenant NNN", "Multi-Tenant NNN"],
  },
];

const StepThree = ({ value, setValue }: any) => {
  const [openIndexes, setOpenIndexes] = useState<number[]>([]);

  const toggleCategory = (category: string, index: number) => {
    if (value[category]) {
      const updated = { ...value };
      delete updated[category];
      setValue(updated);
      setOpenIndexes((prev) => prev.filter((i) => i !== index));
    } else {
      setValue({ ...value, [category]: [] });
      setOpenIndexes((prev) => [...prev, index]);
    }
  };

  const toggleSubType = (category: string, sub: string, index: number) => {
    const existing = value[category] || [];

    const updated = existing.includes(sub)
      ? existing.filter((s: string) => s !== sub)
      : [...existing, sub];

    setValue({
      ...value,
      [category]: updated,
    });

    if (!openIndexes.includes(index)) {
      setOpenIndexes((prev) => [...prev, index]);
    }
  };

  const selectAll = (category: string, subTypes: string[]) => {
    setValue({
      ...value,
      [category]: subTypes,
    });
  };

  const toggleOpen = (index: number) => {
    setOpenIndexes((prev) =>
      prev.includes(index)
        ? prev.filter((i) => i !== index)
        : [...prev, index]
    );
  };

  return (
    <div className="border border-gray-200 rounded-2xl p-6 shadow-sm bg-white">
      {/* HEADER */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <MapPin size={16} />
          Property Types & Sub-Types
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Select property categories and their sub-types.
        </p>
      </div>

      {/* LIST */}
      <div className="flex flex-col gap-4">
        {data.map((item, index) => {
          const isSelected = value[item.name];
          const isOpen = openIndexes.includes(index);

          return (
            <div
              key={item.name}
              className={`rounded-xl border transition-all duration-200 ${
                isSelected
                  ? "border-blue-300 bg-blue-50 shadow-sm"
                  : "border-gray-200 bg-white"
              }`}
            >
              {/* CATEGORY ROW */}
              <div className="flex items-center justify-between px-4 py-3">
                <div
                  className="flex items-center gap-3 cursor-pointer flex-1"
                  onClick={() => toggleCategory(item.name, index)}
                >
                  <input
                    type="checkbox"
                    checked={!!isSelected}
                    readOnly
                    className="accent-blue-600"
                  />

                  <span className="font-medium text-sm">
                    {item.name}
                  </span>

                  {/* SELECTED COUNT */}
                  {isSelected && value[item.name]?.length > 0 && (
                    <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                      {value[item.name].length}
                    </span>
                  )}
                </div>

                {item.subTypes.length > 0 && (
                  <ChevronDown
                    size={18}
                    className={`cursor-pointer transition ${
                      isOpen ? "rotate-180 text-blue-600" : ""
                    }`}
                    onClick={() => toggleOpen(index)}
                  />
                )}
              </div>

              {/* SUB TYPES */}
              {isOpen && isSelected && item.subTypes.length > 0 && (
                <div className="px-4 pb-4">
                  {/* ACTION BAR */}
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-xs text-gray-500 uppercase">
                      Sub-Types
                    </p>

                    <button
                      onClick={() =>
                        selectAll(item.name, item.subTypes)
                      }
                      className="text-xs text-blue-600 font-medium hover:underline"
                    >
                      Select All
                    </button>
                  </div>

                  {/* GRID */}
                  <div className="grid grid-cols-2 gap-3">
                    {item.subTypes.map((sub) => {
                      const checked =
                        value[item.name]?.includes(sub);

                      return (
                        <label
                          key={sub}
                          className={`flex items-center gap-2 border rounded-lg px-3 py-2 text-sm cursor-pointer transition-all duration-200
                          ${
                            checked
                              ? "border-blue-500 bg-blue-50 shadow-sm scale-[1.02]"
                              : "border-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked || false}
                            onChange={() =>
                              toggleSubType(
                                item.name,
                                sub,
                                index
                              )
                            }
                            className="accent-blue-600"
                          />

                          <span className="flex-1">{sub}</span>

                          {checked && (
                            <CheckCircle
                              size={16}
                              className="text-blue-600"
                            />
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StepThree;