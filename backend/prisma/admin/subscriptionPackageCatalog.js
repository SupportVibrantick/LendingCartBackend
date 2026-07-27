/**
 * Canonical subscription package definitions for seeding and public pricing.
 * Features are stored newline-separated in the database.
 */

const SUBSCRIPTION_PACKAGES = [
  {
    name: "Basic",
    code: "BASIC",
    priceMonthly: 199,
    priceYearly: 1990,
    description:
      "Essential tools for solo brokers and small teams getting started on the platform.",
    features: [
      "1 User Access (up to 10 users)",
      "Unlimited Borrowers",
      "Bridge, DSCR, Fix & Flip, Construction (1-4 unit)",
      "20+ Lenders",
      "Web-Based Loan Application",
      "Broker Portal",
      "Client Portal",
      "Loan Pipeline & Dashboard",
      "Lender Matching Tool",
      "Document Request, Upload & Send to Lender",
      "Email Notifications & Reminders",
      "Performance Dashboard",
      "Email Support",
    ],
    usageLimits: {
      LOAN_APPLICATIONS: 50,
      ACTIVE_USERS: 10,
      LOAN_OFFICERS: 5,
      LENDER_CONNECTIONS: 10,
    },
    sortOrder: 1,
    isPopular: false,
  },
  {
    name: "Pro",
    code: "PRO",
    priceMonthly: 399,
    priceYearly: 3990,
    description:
      "Advanced automation for growing brokerages that need co-brokers, LOI workflow, and marketing tools.",
    features: [
      "Everything in Basic",
      "3 Users Access (up to 25 users)",
      "Unlimited Co-Brokers",
      "CRE, Agency, CMBS, Mezz/Pref Products",
      "40+ Lenders",
      "Lender Marketplace",
      "Add Your Own Lenders",
      "External Co-Broker Portals",
      "Loan Officer Portals",
      "White Labeling (Logo & Brand Name)",
      "LOI / Term Sheet Workflow",
      "Fee Agreement & E-Signatures",
      "Custom Document Types",
      "Email Marketing Campaigns",
      "Commission Tracking",
      "In-App Chat on Deals",
      "Website Builder",
      "Priority Support",
    ],
    usageLimits: {
      LOAN_APPLICATIONS: 200,
      ACTIVE_USERS: 25,
      LOAN_OFFICERS: 15,
      LENDER_CONNECTIONS: 50,
    },
    sortOrder: 2,
    isPopular: true,
  },
  {
    name: "Elite",
    code: "ELITE",
    priceMonthly: 599,
    priceYearly: 5990,
    description:
      "Full platform access for high-volume teams with all loan products, analytics, and white-label options.",
    features: [
      "Everything in Pro",
      "5 Users Access (up to 100 users)",
      "All Lending Products (SBA, USDA, Asset-Based)",
      "100+ Lenders",
      "Advanced CRM (Contacts & Borrowers)",
      "Advanced Document Automation",
      "Auto-Forward Documents to Lender & Client",
      "Document Activity Timeline",
      "Platform Reports & Analytics",
      "White-Label (Custom Domain — coming soon)",
      "Dedicated Account Manager",
      "API Access (coming soon)",
    ],
    usageLimits: {
      LOAN_APPLICATIONS: 1000,
      ACTIVE_USERS: 100,
      LOAN_OFFICERS: 50,
      LENDER_CONNECTIONS: 200,
    },
    sortOrder: 3,
    isPopular: false,
  },
];

const SUBSCRIPTION_ADD_ONS = [
  {
    code: "EXTRA_USER",
    name: "Per User Access",
    priceMonthly: 100,
    isPurchasable: true,
    usageBoost: { ACTIVE_USERS: 1 },
  },
  {
    code: "CRE_PACK",
    name: "CRE & Multifamily Product Pack",
    priceMonthly: 50,
    isPurchasable: true,
  },
  {
    code: "ABL_PACK",
    name: "Asset-Based Lending Pack",
    priceMonthly: 50,
    isPurchasable: true,
  },
  {
    code: "SBA_PACK",
    name: "SBA & USDA Product Pack",
    priceMonthly: 50,
    isPurchasable: true,
  },
  {
    code: "WHITE_LABEL",
    name: "White-Labeling (Custom Domain)",
    priceMonthly: 50,
    isPurchasable: true,
  },
  {
    code: "GHL_INTEGRATION",
    name: "GoHighLevel Integrations",
    priceMonthly: 100,
    note: "Coming soon",
    isPurchasable: false,
  },
  {
    code: "ESIGN",
    name: "E-Signature Add-On",
    priceMonthly: 50,
    note: "Included in Pro & Elite",
    isPurchasable: true,
    includedInPackageCodes: ["PRO", "ELITE"],
  },
];

function featuresToStorage(features = []) {
  return features.join("\n");
}

function packageToSeedData(pkg) {
  return {
    name: pkg.name,
    code: pkg.code,
    priceMonthly: pkg.priceMonthly,
    priceYearly: pkg.priceYearly,
    description: pkg.description,
    features: featuresToStorage(pkg.features),
    usageLimits: pkg.usageLimits,
    sortOrder: pkg.sortOrder,
    isPopular: pkg.isPopular,
    isActive: true,
  };
}

module.exports = {
  SUBSCRIPTION_PACKAGES,
  SUBSCRIPTION_ADD_ONS,
  featuresToStorage,
  packageToSeedData,
};
