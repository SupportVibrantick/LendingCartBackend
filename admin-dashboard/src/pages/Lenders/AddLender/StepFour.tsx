import { ChevronDown, BriefcaseBusiness, CheckCircle } from "lucide-react";
import { useState } from "react";

const data = [
  {
    name: "Food & Beverage",
    subTypes: [
      "Restaurant – Casual Dining",
      "Restaurant – Fast Food / QSR",
      "Restaurant – Fine Dining",
      "Bar / Nightclub",
      "Food Manufacturing / Processing",
      "Grocery / Convenience Store",
      "Bakery / Café",
      "Food Truck / Catering",
      "Brewery / Winery / Distillery",
    ],
  },
  {
    name: "Healthcare & Medical",
    subTypes: [
      "Medical Practice",
      "Dental Practice",
      "Veterinary Clinic",
      "Pharmacy",
      "Home Health Agency",
      "Mental Health Practice",
      "Medical Spa / Aesthetics",
      "Physical Therapy",
      "Urgent Care",
    ],
  },
  {
    name: "Retail & Consumer",
    subTypes: [
      "General Retail",
      "E-Commerce",
      "Specialty Boutique",
      "Franchise Retail",
      "Auto Dealership",
      "Pawn / Resale Shop",
    ],
  },
  {
    name: "Professional Services",
    subTypes: [
      "Legal",
      "Accounting / CPA",
      "Consulting",
      "Marketing / Advertising",
      "Engineering / Architecture",
      "IT / Technology Services",
      "Staffing Agency",
    ],
  },
  {
    name: "Technology",
    subTypes: [
      "SaaS / Software",
      "IT Services",
      "Cybersecurity",
      "E-Commerce Tech",
      "Biotech / Medtech",
      "Fintech",
    ],
  },
  {
    name: "Manufacturing & Industrial",
    subTypes: [
      "Light Manufacturing",
      "Heavy Manufacturing",
      "Printing / Publishing",
      "Textile / Apparel",
      "Electronics",
      "Aerospace / Defense",
    ],
  },
  {
    name: "Construction & Trades",
    subTypes: [
      "General Contractor",
      "Specialty Contractor",
      "Plumbing / Electrical / HVAC",
      "Landscaping",
      "Janitorial / Cleaning",
      "Roofing",
    ],
  },
  {
    name: "Transportation & Logistics",
    subTypes: [
      "Trucking / Freight",
      "Courier / Delivery",
      "Warehousing / Fulfillment",
      "Logistics / 3PL",
      "Moving Company",
      "Auto Transport",
    ],
  },
  {
    name: "Hospitality & Entertainment",
    subTypes: [
      "Hotel / Motel",
      "Event Venue",
      "Gym / Fitness",
      "Spa / Salon",
      "Recreation / Amusement",
      "Travel Agency",
    ],
  },
  {
    name: "Automotive",
    subTypes: [
      "Auto Repair / Body Shop",
      "Car Dealership",
      "Car Wash / Detailing",
      "Auto Parts",
      "Towing",
    ],
  },
  {
    name: "Financial Services",
    subTypes: [
      "Mortgage / Lending",
      "Insurance Agency",
      "Wealth Management",
      "Tax Preparation",
      "Pawn Shop",
    ],
  },
  {
    name: "Education & Childcare",
    subTypes: [
      "Daycare / Preschool",
      "Private K-12",
      "Tutoring Center",
      "Vocational School",
      "After-School Programs",
    ],
  },
  {
    name: "Agriculture & Farming",
    subTypes: [
      "Crop Farming",
      "Livestock",
      "Greenhouse / Nursery",
      "Aquaculture",
      "Agribusiness",
    ],
  },
  {
    name: "Energy",
    subTypes: [
      "Solar / Renewables",
      "Oil & Gas Services",
      "Energy Efficiency",
      "Utilities",
    ],
  },
  {
    name: "Non-Profit & Government",
    subTypes: [
      "501(c)(3) Non-Profit",
      "Religious Organization",
      "Government Contractor",
      "Municipal",
    ],
  },
  {
    name: "Franchise",
    subTypes: [
      "Food & Beverage Franchise",
      "Service Franchise",
      "Retail Franchise",
      "Fitness Franchise",
    ],
  },
];

const StepFour = ({ value, setValue }: any) => {
  const [openIndexes, setOpenIndexes] = useState<number[]>([]);

  const toggleCategory = (category: string) => {
    if (value[category]) {
      const updated = { ...value };
      delete updated[category];
      setValue(updated);
    } else {
      setValue({
        ...value,
        [category]: [],
      });
    }
  };

  const toggleSubType = (category: string, sub: string) => {
    const existing = value[category] || [];

    const updated = existing.includes(sub)
      ? existing.filter((s: string) => s !== sub)
      : [...existing, sub];

    setValue({
      ...value,
      [category]: updated,
    });
  };

  const selectAll = (category: string, subTypes: string[]) => {
    setValue({
      ...value,
      [category]: subTypes,
    });
  };

  const toggleOpen = (index: number) => {
    setOpenIndexes((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
    );
  };

  return (
    <div className="border border-gray-200 rounded-2xl p-6 shadow-sm bg-white">
      {/* HEADER */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BriefcaseBusiness size={16} />
          Business Types & Industries
        </h2>

        <p className="text-sm text-gray-500 mt-1">
          Select industries this lender supports.
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
                  ? "border-purple-300 bg-purple-50 shadow-sm"
                  : "border-gray-200 bg-white"
              }`}
            >
              {/* CATEGORY */}
              <div className="flex items-center justify-between px-4 py-3">
                <div
                  className="flex items-center gap-3 cursor-pointer flex-1"
                  onClick={() => toggleCategory(item.name)}
                >
                  <input
                    type="checkbox"
                    checked={!!isSelected}
                    readOnly
                    className="accent-purple-600"
                  />

                  <span className="font-medium text-sm">{item.name}</span>

                  {/* COUNT BADGE */}
                  {isSelected && value[item.name]?.length > 0 && (
                    <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">
                      {value[item.name].length}
                    </span>
                  )}
                </div>

                {item.subTypes.length > 0 && (
                  <ChevronDown
                    size={18}
                    className={`cursor-pointer transition ${
                      isOpen ? "rotate-180 text-purple-600" : ""
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
                    <p className="text-xs text-gray-500 uppercase">Sub-Types</p>

                    <button
                      onClick={() => selectAll(item.name, item.subTypes)}
                      className="text-xs text-purple-600 font-medium hover:underline"
                    >
                      Select All
                    </button>
                  </div>

                  {/* GRID */}
                  <div className="grid grid-cols-2 gap-3">
                    {item.subTypes.map((sub) => {
                      const checked = value[item.name]?.includes(sub);

                      return (
                        <label
                          key={sub}
                          className={`flex items-center gap-2 border rounded-lg px-3 py-2 text-sm cursor-pointer transition-all duration-200
                          ${
                            checked
                              ? "border-purple-500 bg-purple-50 shadow-sm scale-[1.02]"
                              : "border-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked || false}
                            onChange={() => toggleSubType(item.name, sub)}
                            className="accent-purple-600"
                          />

                          <span className="flex-1">{sub}</span>

                          {checked && (
                            <CheckCircle
                              size={16}
                              className="text-purple-600"
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

export default StepFour;
