/**
 * Full plan comparison matrix for the Loan AI pricing page.
 * Values: `true` = included (✓), `false` = not included (—), string = custom cell text.
 */

/** @typedef {boolean | string} ComparisonCell */

/**
 * @typedef {Object} ComparisonRow
 * @property {string} feature
 * @property {ComparisonCell} basic
 * @property {ComparisonCell} pro
 * @property {ComparisonCell} elite
 */

/** @type {ComparisonRow[]} */
export const PLAN_COMPARISON_ROWS = [
  {
    feature: "Users Included",
    basic: "1 (up to 10)",
    pro: "3 (up to 25)",
    elite: "5 (up to 100)",
  },
  {
    feature: "Unlimited Borrowers",
    basic: true,
    pro: true,
    elite: true,
  },
  {
    feature: "Unlimited Co-Brokers",
    basic: false,
    pro: true,
    elite: true,
  },
  {
    feature: "Bridge, DSCR, Fix & Flip, Construction",
    basic: true,
    pro: true,
    elite: true,
  },
  {
    feature: "CRE, Agency, CMBS, Mezz/Pref",
    basic: false,
    pro: true,
    elite: true,
  },
  {
    feature: "SBA, USDA, Asset-Based",
    basic: false,
    pro: false,
    elite: true,
  },
  {
    feature: "Lender Network",
    basic: "20+",
    pro: "40+",
    elite: "100+",
  },
  {
    feature: "Lender Marketplace",
    basic: false,
    pro: true,
    elite: true,
  },
  {
    feature: "Add Your Own Lenders",
    basic: false,
    pro: true,
    elite: true,
  },
  {
    feature: "Broker Portal",
    basic: true,
    pro: true,
    elite: true,
  },
  {
    feature: "Client Portal",
    basic: true,
    pro: true,
    elite: true,
  },
  {
    feature: "Co-Broker Portals",
    basic: false,
    pro: true,
    elite: true,
  },
  {
    feature: "Loan Officer Portals",
    basic: false,
    pro: true,
    elite: true,
  },
  {
    feature: "Fee Agreement & E-Signatures",
    basic: true,
    pro: true,
    elite: true,
  },
  {
    feature: "Lender Matching Tool",
    basic: true,
    pro: true,
    elite: true,
  },
  {
    feature: "Document Request & Upload",
    basic: true,
    pro: true,
    elite: true,
  },
  {
    feature: "Auto-Forward to Lender & Client",
    basic: false,
    pro: false,
    elite: true,
  },
  {
    feature: "Document Activity Timeline",
    basic: false,
    pro: true,
    elite: true,
  },
  {
    feature: "Custom Document Types",
    basic: false,
    pro: true,
    elite: true,
  },
  {
    feature: "LOI / Term Sheet Workflow",
    basic: false,
    pro: true,
    elite: true,
  },
  {
    feature: "Commission Tracking",
    basic: false,
    pro: true,
    elite: true,
  },
  {
    feature: "In-App Chat on Deals",
    basic: false,
    pro: true,
    elite: true,
  },
  {
    feature: "Pre-Underwriting Checklist",
    basic: false,
    pro: true,
    elite: true,
  },
  {
    feature: "Auto Deal Summary (PDF)",
    basic: false,
    pro: true,
    elite: true,
  },
  {
    feature: "Basic Website Builder (1-page)",
    basic: true,
    pro: true,
    elite: true,
  },
  {
    feature: "Full Website Builder (multi-page)",
    basic: false,
    pro: true,
    elite: true,
  },
  {
    feature: "White Labeling (Logo & Brand)",
    basic: false,
    pro: true,
    elite: true,
  },
  {
    feature: "White-Label Custom Domain",
    basic: false,
    pro: false,
    elite: true,
  },
  {
    feature: "Basic CRM",
    basic: false,
    pro: true,
    elite: true,
  },
  {
    feature: "Advanced CRM",
    basic: false,
    pro: false,
    elite: true,
  },
  {
    feature: "Email Marketing Campaigns",
    basic: false,
    pro: true,
    elite: true,
  },
  {
    feature: "Platform Reports & Analytics",
    basic: false,
    pro: true,
    elite: true,
  },
  {
    feature: "GHL Basic Sync (Add-On)",
    basic: false,
    pro: true,
    elite: true,
  },
  {
    feature: "GHL Advanced CRM (Done-For-You)",
    basic: false,
    pro: false,
    elite: true,
  },
  {
    feature: "GHL Social Media & Campaigns",
    basic: false,
    pro: false,
    elite: true,
  },
  {
    feature: "GHL Email & SMS Campaigns",
    basic: false,
    pro: false,
    elite: true,
  },
  {
    feature: "GHL Websites + Funnels",
    basic: false,
    pro: false,
    elite: true,
  },
  {
    feature: "GHL AI Appointment Agent",
    basic: false,
    pro: false,
    elite: true,
  },
  {
    feature: "GHL Voice AI Agents",
    basic: false,
    pro: false,
    elite: true,
  },
  {
    feature: "Support Level",
    basic: "Email",
    pro: "Priority",
    elite: "Dedicated Mgr",
  },
];
