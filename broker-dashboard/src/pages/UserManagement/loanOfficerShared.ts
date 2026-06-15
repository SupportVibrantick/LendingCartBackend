export const PERMISSIONS = [
  {
    title: "Loan Management",
    items: [
      { label: "View Loan Pipeline", key: "VIEW_PIPELINE" },
      { label: "View Applications", key: "VIEW_APPLICATIONS" },
      { label: "Create Applications", key: "CREATE_APPLICATION" },
    ],
  },
  {
    title: "Team Management",
    items: [{ label: "Manage Loan Officers", key: "MANAGE_LOAN_OFFICERS" }],
  },
  {
    title: "Clients",
    items: [
      { label: "View Clients", key: "VIEW_CLIENTS" },
      { label: "Manage Clients", key: "MANAGE_CLIENTS" },
    ],
  },
  {
    title: "Lenders",
    items: [{ label: "View Lenders", key: "VIEW_LENDERS" }],
  },
  {
    title: "Templates & Website",
    items: [
      { label: "View Templates", key: "VIEW_TEMPLATES" },
      { label: "Manage Templates", key: "MANAGE_TEMPLATES" },
      { label: "Website Builder Access", key: "VIEW_WEBSITE_BUILDER" },
    ],
  },
  {
    title: "Settings",
    items: [
      { label: "View Settings", key: "VIEW_SETTINGS" },
      { label: "Manage Settings", key: "MANAGE_SETTINGS" },
    ],
  },
  {
    title: "Reports & Logs",
    items: [
      { label: "View Logs", key: "VIEW_LOGS" },
      { label: "View Dashboard Stats", key: "VIEW_STATS" },
    ],
  },
  {
    title: "Notifications",
    items: [{ label: "View Notifications", key: "VIEW_NOTIFICATIONS" }],
  },
];

export const US_STATES = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
];

export function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);

  if (digits.length < 4) return digits;
  if (digits.length < 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;

  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function getPermissionLabel(key: string) {
  for (const group of PERMISSIONS) {
    const found = group.items.find((item) => item.key === key);
    if (found) return found.label;
  }
  return key;
}
