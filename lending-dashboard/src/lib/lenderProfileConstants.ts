export const PROFILE_SECTIONS = [
  {
    id: "company",
    label: "Company Profile",
    description: "Business identity and primary contact details",
  },
  {
    id: "lending-criteria",
    label: "Lending Criteria",
    description: "High-level criteria brokers should know upfront",
  },
  {
    id: "lending-guidelines",
    label: "Lending Guidelines",
    description: "Underwriting and policy guidelines",
  },
  {
    id: "geographic",
    label: "Geographic Coverage",
    description: "States and regions you lend in",
  },
  {
    id: "loan-programs",
    label: "Loan Programs",
    description: "Programs offered to brokers",
  },
  {
    id: "loan-amounts",
    label: "Loan Amounts",
    description: "Minimum and maximum loan sizes",
  },
  {
    id: "credit",
    label: "Credit Requirements",
    description: "Borrower credit and experience expectations",
  },
  {
    id: "property",
    label: "Property Requirements",
    description: "Collateral and property standards",
  },
  {
    id: "industries",
    label: "Industry Restrictions",
    description: "Industries you will or will not finance",
  },
  {
    id: "documents",
    label: "Required Documents",
    description: "Document packages by loan program",
  },
] as const;

export type ProfileSectionId = (typeof PROFILE_SECTIONS)[number]["id"];

export const US_STATES = [
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming",
].map((value) => ({ value, label: value }));

export const INDUSTRIES = [
  "Real Estate",
  "Hospitality",
  "Healthcare",
  "Construction",
  "Retail",
  "Restaurants",
  "Manufacturing",
  "Transportation",
  "Logistics",
  "Technology",
  "Education",
  "Automotive",
  "E-Commerce",
  "Finance",
  "Insurance",
  "Energy",
  "Agriculture",
  "Entertainment",
  "Fitness",
  "Beauty",
].map((value) => ({ value, label: value }));

export const selectClassNames = (hasError = false) => ({
  control: ({ isFocused }: { isFocused: boolean }) =>
    `!min-h-[44px] !rounded-2xl !border !bg-slate-50 dark:!bg-slate-800 ${
      hasError
        ? "!border-red-500"
        : isFocused
          ? "!border-[#183b57]"
          : "!border-slate-200 dark:!border-slate-700"
    }`,
  menu: () =>
    "!rounded-2xl !overflow-hidden !border !border-slate-200 dark:!border-slate-700 !bg-white dark:!bg-slate-800",
  option: ({
    isFocused,
    isSelected,
  }: {
    isFocused: boolean;
    isSelected: boolean;
  }) =>
    `!text-sm ${
      isSelected
        ? "!bg-[#183b57] !text-white"
        : isFocused
          ? "!bg-slate-100 dark:!bg-slate-700"
          : "!bg-white dark:!bg-slate-800"
    }`,
  multiValue: () => "!bg-[#183b57]/10 !rounded-xl",
  multiValueLabel: () => "!text-[#183b57] !text-xs !font-medium",
  multiValueRemove: () => "!hover:bg-red-500 hover:!text-white !rounded-r-xl",
  placeholder: () => "!text-slate-400 !text-sm",
  input: () => "dark:!text-white",
  menuList: () => "dark:!bg-slate-800",
});
