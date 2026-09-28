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
    basic: "1",
    pro: "5",
    elite: "10",
  },
  {
    feature: "Broker Portal",
    basic: true,
    pro: true,
    elite: true,
  },
  {
    feature: "Unlimited Borrowers",
    basic: true,
    pro: true,
    elite: true,
  },
  {
    feature: "Unlimited Client Portals",
    basic: true,
    pro: true,
    elite: true,
  },
  {
    feature: "Web-Based Loan Application",
    basic: true,
    pro: true,
    elite: true,
  },
  {
    feature: "Loan Pipeline & Dashboard",
    basic: true,
    pro: true,
    elite: true,
  },
  {
    feature: "Performance Dashboard",
    basic: true,
    pro: true,
    elite: true,
  },
  {
    feature: "Loan Status & Doc Upload Portal",
    basic: true,
    pro: true,
    elite: true,
  },
  {
    feature: "1-4 unit Residential",
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
    feature: "Custom Document Types",
    basic: true,
    pro: true,
    elite: true,
  },
  {
    feature: "Document Activity Timeline",
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
    feature: "CRE & Multifamily",
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
    feature: "Commission Tracking",
    basic: false,
    pro: true,
    elite: true,
  },
  {
    feature: "Internal Chat (Lenders+Clients)",
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
    feature: "Auto Deal Summary (PDF for lenders)",
    basic: false,
    pro: true,
    elite: true,
  },
  {
    feature: "Fee Agreement & Term Sheet",
    basic: false,
    pro: true,
    elite: true,
  },
  {
    feature: "GHL STARTER",
    basic: false,
    pro: true,
    elite: true,
  },
  {
    feature: "Advanced CRM Integration",
    basic: false,
    pro: true,
    elite: true,
  },
  {
    feature: "Advanced Calendar Sync",
    basic: false,
    pro: true,
    elite: true,
  },
  {
    feature: "Websites & Funnels Builder",
    basic: false,
    pro: true,
    elite: true,
  },
  {
    feature: "Email & SMS Marketing Campaigns",
    basic: false,
    pro: true,
    elite: true,
  },
  {
    feature: "Priority Support",
    basic: false,
    pro: true,
    elite: true,
  },
  {
    feature: "SBA & USDA Loans",
    basic: false,
    pro: false,
    elite: true,
  },
  {
    feature: "Asset-Based Lending",
    basic: false,
    pro: false,
    elite: true,
  },
  {
    feature: "Lender Marketplace (Add Lenders)",
    basic: false,
    pro: false,
    elite: true,
  },
  {
    feature: "Auto-Forward Docs (Client/Lenders)",
    basic: false,
    pro: false,
    elite: true,
  },
  {
    feature: "White Label",
    basic: false,
    pro: false,
    elite: true,
  },
  {
    feature: "Auto Follow-up (Clients/Lenders)",
    basic: false,
    pro: false,
    elite: true,
  },
  {
    feature: "GHL GROWTH",
    basic: false,
    pro: false,
    elite: true,
  },
  {
    feature: "Advanced CRM & Calendar Integration",
    basic: false,
    pro: false,
    elite: true,
  },
  {
    feature: "Social Media Integration & Campaigns",
    basic: false,
    pro: false,
    elite: true,
  },
  {
    feature: "Email & SMS (Pre-Built Campaigns)",
    basic: false,
    pro: false,
    elite: true,
  },
  {
    feature: "Advanced Workflow Automation",
    basic: false,
    pro: false,
    elite: true,
  },
  {
    feature: "Unlimited Websites & Funnels",
    basic: false,
    pro: false,
    elite: true,
  },
  {
    feature: "Unlimited Webinars + Funnels",
    basic: false,
    pro: false,
    elite: true,
  },
  {
    feature: "Unlimited Sub-Domains",
    basic: false,
    pro: false,
    elite: true,
  },
  {
    feature: "AI Appointment Setup Agent",
    basic: false,
    pro: false,
    elite: true,
  },
  {
    feature: "Voice AI Agents (Inbound & Outbound)",
    basic: false,
    pro: false,
    elite: true,
  },
  {
    feature: "Onboarding Assistance",
    basic: false,
    pro: false,
    elite: true,
  },
];
