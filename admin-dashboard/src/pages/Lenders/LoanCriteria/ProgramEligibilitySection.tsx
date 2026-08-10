import { useState, type ReactNode } from "react";
import {
  Briefcase,
  ChevronDown,
  FileText,
} from "lucide-react";

/** Keep in sync with LoanCriteria/StepThree options */
export const PROPERTY_TYPE_OPTIONS = [
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

/** Keep in sync with LoanCriteria/StepFour options */
export const BUSINESS_TYPE_OPTIONS = [
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

type OptionItem = { name: string; subTypes: string[] };

type Accent = "emerald" | "violet";

const accentStyles: Record<
  Accent,
  {
    badge: string;
    parentOn: string;
    parentOff: string;
    subOn: string;
    subOff: string;
  }
> = {
  emerald: {
    badge: "bg-emerald-500 text-white",
    parentOn: "border-emerald-500 bg-emerald-500 text-white shadow-sm",
    parentOff:
      "border-slate-300 bg-white text-slate-700 hover:border-emerald-400 hover:bg-emerald-50",
    subOn: "border-emerald-600 bg-emerald-600 text-white",
    subOff:
      "border-slate-300 bg-white text-slate-600 hover:border-emerald-400 hover:bg-emerald-50",
  },
  violet: {
    badge: "bg-violet-600 text-white",
    parentOn: "border-violet-600 bg-violet-600 text-white shadow-sm",
    parentOff:
      "border-slate-300 bg-white text-slate-700 hover:border-violet-400 hover:bg-violet-50",
    subOn: "border-violet-700 bg-violet-700 text-white",
    subOff:
      "border-slate-300 bg-white text-slate-600 hover:border-violet-400 hover:bg-violet-50",
  },
};

type EligibilityPickerProps = {
  title: string;
  description: string;
  icon: ReactNode;
  options: OptionItem[];
  value: Record<string, string[]>;
  setValue: (next: Record<string, string[]>) => void;
  defaultOpen?: boolean;
  accent: Accent;
};

function Chip({
  label,
  selected,
  onClick,
  selectedClass,
  unselectedClass,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  selectedClass: string;
  unselectedClass: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
        selected ? selectedClass : unselectedClass
      }`}
    >
      {label}
    </button>
  );
}

function EligibilityPicker({
  title,
  description,
  icon,
  options,
  value,
  setValue,
  defaultOpen = false,
  accent,
}: EligibilityPickerProps) {
  const [open, setOpen] = useState(defaultOpen);
  const styles = accentStyles[accent];
  const selectedCount = Object.keys(value || {}).length;

  const toggleCategory = (category: string) => {
    if (Object.prototype.hasOwnProperty.call(value, category)) {
      const updated = { ...value };
      delete updated[category];
      setValue(updated);
      return;
    }
    setValue({ ...value, [category]: [] });
  };

  const toggleSubType = (category: string, sub: string) => {
    const existing = value[category] || [];
    const updated = existing.includes(sub)
      ? existing.filter((s) => s !== sub)
      : [...existing, sub];
    setValue({ ...value, [category]: updated });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="text-slate-500">{icon}</span>
          <span className="text-sm font-semibold text-slate-800">{title}</span>
          {selectedCount > 0 && (
            <span
              className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${styles.badge}`}
            >
              {selectedCount}
            </span>
          )}
        </div>
        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3">
          <p className="mb-3 text-xs leading-relaxed text-slate-500">
            {description}
          </p>

          <div className="flex flex-col gap-2.5">
            {options.map((item) => {
              const selected = Object.prototype.hasOwnProperty.call(
                value,
                item.name,
              );
              const selectedSubs = value[item.name] || [];

              return (
                <div
                  key={item.name}
                  className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:thin]"
                >
                  <Chip
                    label={item.name}
                    selected={selected}
                    onClick={() => toggleCategory(item.name)}
                    selectedClass={styles.parentOn}
                    unselectedClass={styles.parentOff}
                  />

                  {selected &&
                    item.subTypes.map((sub) => (
                      <Chip
                        key={sub}
                        label={sub}
                        selected={selectedSubs.includes(sub)}
                        onClick={() => toggleSubType(item.name, sub)}
                        selectedClass={styles.subOn}
                        unselectedClass={styles.subOff}
                      />
                    ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

type ProgramEligibilitySectionProps = {
  propertyTypes: Record<string, string[]>;
  setPropertyTypes: (next: Record<string, string[]>) => void;
  businessTypes: Record<string, string[]>;
  setBusinessTypes: (next: Record<string, string[]>) => void;
};

export default function ProgramEligibilitySection({
  propertyTypes,
  setPropertyTypes,
  businessTypes,
  setBusinessTypes,
}: ProgramEligibilitySectionProps) {
  return (
    <div className="mt-6">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Program-Specific Eligibility
      </h3>

      <div className="space-y-2">
        <EligibilityPicker
          title="Eligible Property Types"
          description="Select the eligible property types eligible for this specific loan program. These are independent per program."
          icon={<FileText size={15} />}
          options={PROPERTY_TYPE_OPTIONS}
          value={propertyTypes || {}}
          setValue={setPropertyTypes}
          defaultOpen
          accent="emerald"
        />
        <EligibilityPicker
          title="Eligible Business Types"
          description="Select the eligible business types eligible for this specific loan program. These are independent per program."
          icon={<Briefcase size={15} />}
          options={BUSINESS_TYPE_OPTIONS}
          value={businessTypes || {}}
          setValue={setBusinessTypes}
          accent="violet"
        />
      </div>
    </div>
  );
}
