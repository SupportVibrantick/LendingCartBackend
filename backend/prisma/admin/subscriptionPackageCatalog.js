/**
 * Canonical subscription package definitions for seeding and public pricing.
 *
 * Features are stored as JSON in `SubscriptionPackage.features` so the
 * frontend can render section headings (e.g. CORE PLATFORM) and highlight
 * blocks (e.g. Advanced GHL Integrations) without hardcoding plan copy.
 *
 * Storage shape:
 * {
 *   badge?: string | null,
 *   usersLabel?: string,
 *   includedUsers?: number,
 *   maxUsers?: number,
 *   extraUserPrice?: number,
 *   groups: [{ heading, items: (string | { label, children: string[] })[], variant?: "default" | "highlight" }]
 * }
 */

const SUBSCRIPTION_PACKAGES = [
  {
    name: "Starter",
    code: "BASIC",
    priceMonthly: 199,
    // 20% off vs paying monthly for 12 months
    priceYearly: 1910,
    description: "For independent brokers getting started",
    badge: null,
    usersLabel: "Add up to 5 users · Additional User Cost: $99/m",
    includedUsers: 1,
    maxUsers: 5,
    extraUserPrice: 99,
    featureGroups: [
      {
        heading: "CORE PLATFORM",
        items: [
          "Broker Portal",
          "Unlimited Borrowers",
          "Unlimited Client Portals",
          "Web-Based Loan Application",
          "Loan Pipeline & Dashboard",
          "Performance Dashboard",
          "Loan Status & Doc Upload Portal",
          {
            label: "1-4 unit Residential",
            children: [
              "Bridge Loans",
              "Fix & Flip Loans",
              "DSCR Loans",
              "Construction Loans",
              "Rental portfolio Loans",
            ],
          },
          "Lender Matching Tool",
          "Custom Document Types",
          "Document Activity Timeline",
        ],
      },
    ],
    usageLimits: {
      LOAN_APPLICATIONS: 50,
      CO_BROKERS: 5,
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
    priceYearly: 3830,
    description: "For growing brokerages with a team",
    badge: "MOST POPULAR",
    usersLabel: "Add up to 10 users · Additional User Cost: $79/m",
    includedUsers: 5,
    maxUsers: 10,
    extraUserPrice: 79,
    featureGroups: [
      {
        heading: "EVERYTHING IN STARTER, PLUS:",
        items: [
          "Co-Broker Portals",
          "Loan Officer Portals",
          {
            label: "CRE & Multifamily",
            children: [
              "Bridge Loans",
              "Value Add Property Loans",
              "Construction Loans",
              "CRE Permanent Loans",
              "Conventional Loans",
              "CMBS Loans",
              "Agency Loans for Multifamily",
              "C-Pace Loans",
              "Mezzanine & Preferred Equity",
            ],
          },
          "Commission Tracking",
          "Internal Chat (Lenders/Clients)",
          "Pre-Underwriting Checklist",
          "Auto Deal Summary (PDF for lenders)",
          "Fee Agreement & Term Sheet",
        ],
      },
      {
        heading: "GHL STARTER",
        items: [
          "Advanced CRM Integration",
          "Advanced Calendar Sync",
          "Websites & Funnels Builder",
          "Email & SMS Marketing Campaigns",
          "Priority Support",
        ],
      },
    ],
    usageLimits: {
      LOAN_APPLICATIONS: 200,
      CO_BROKERS: 10,
      LOAN_OFFICERS: 15,
      LENDER_CONNECTIONS: 50,
    },
    sortOrder: 2,
    isPopular: true,
  },
  {
    name: "Elite",
    code: "ELITE",
    priceMonthly: 699,
    priceYearly: 6710,
    description: "For teams at scale + full GHL suite",
    badge: "BEST VALUE",
    usersLabel: "Add up to 25 users · Additional User Cost: $49/m",
    includedUsers: 10,
    maxUsers: 25,
    extraUserPrice: 49,
    featureGroups: [
      {
        heading: "EVERYTHING IN PRO, PLUS:",
        items: [
          {
            label: "SBA & USDA Loans",
            children: [
              "SBA 7(a) Express",
              "SBA 7(a) Business Acquisition",
              "SBA 7(a) Equipment Finance",
              "SBA 7(a) Working Capital",
              "SBA 7(a) Real Estate + Construction",
              "SBA 504 Real Estate + Business",
              "SBA 504 Real Estate Construction",
              "USDA Business & Industry",
            ],
          },
          {
            label: "Asset-Based Lending",
            children: [
              "Equipment Finance",
              "Accounts Receivable Finance",
              "Accounts Payable Finance",
              "Purchase Order Finance",
            ],
          },
          "Lender Marketplace",
          "Add Your Own Lenders",
          "Auto-Forward Docs (Client/Lenders)",
          "White Label",
          "Auto Follow-up (Clients/Lenders)",
        ],
      },
      {
        heading: "GHL GROWTH",
        variant: "highlight",
        items: [
          "Advanced CRM & Calendar Integration",
          "Social Media Integration & Campaigns",
          "Email & SMS (Pre-Built Campaigns)",
          "Advanced Workflow Automation",
          "Unlimited Websites & Funnels",
          "Unlimited Webinars + Funnels",
          "Unlimited Sub-Domains",
          "AI Appointment Setup Agent",
          "Voice AI Agents (Inbound & Outbound)",
          "Onboarding Assistance",
        ],
      },
    ],
    usageLimits: {
      LOAN_APPLICATIONS: 1000,
      CO_BROKERS: 25,
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
    name: "Additional Users",
    priceMonthly: 99,
    isPurchasable: true,
    usageBoost: { CO_BROKERS: 1, ACTIVE_USERS: 1 },
    quantityBased: true,
  },
  {
    code: "CRE_PACK",
    name: "CRE & Multifamily",
    priceMonthly: 59,
    note: "Starter",
    isPurchasable: true,
    availableForPackageCodes: ["BASIC"],
    includedInPackageCodes: ["PRO", "ELITE"],
  },
  {
    code: "FEE_AGREEMENT_PACK",
    name: "FEE Agreement & Term Sheet",
    priceMonthly: 59,
    note: "Starter",
    isPurchasable: true,
    availableForPackageCodes: ["BASIC"],
    includedInPackageCodes: ["PRO", "ELITE"],
  },
  {
    code: "BUSINESS_LENDING_PACK",
    name: "Business Lending (SBA, USDA, ABL)",
    priceMonthly: 99,
    priceByPackage: { BASIC: 99, PRO: 79 },
    note: "Starter/Pro",
    isPurchasable: true,
    availableForPackageCodes: ["BASIC", "PRO"],
    includedInPackageCodes: ["ELITE"],
  },
  // Legacy individual packs — kept for existing subscribers, hidden from pricing UI
  {
    code: "ABL_PACK",
    name: "Asset-Based Lending",
    priceMonthly: 50,
    note: "Legacy",
    isPurchasable: false,
    availableForPackageCodes: ["BASIC", "PRO"],
    includedInPackageCodes: ["ELITE"],
  },
  {
    code: "SBA_PACK",
    name: "SBA & USDA",
    priceMonthly: 50,
    note: "Legacy",
    isPurchasable: false,
    availableForPackageCodes: ["BASIC", "PRO"],
    includedInPackageCodes: ["ELITE"],
  },
  {
    code: "LENDER_MARKETPLACE_PACK",
    name: "Lender Marketplace + Add Lenders",
    priceMonthly: 79,
    priceByPackage: { BASIC: 79, PRO: 59 },
    note: "Starter/Pro",
    isPurchasable: true,
    availableForPackageCodes: ["BASIC", "PRO"],
    includedInPackageCodes: ["ELITE"],
  },
  {
    code: "GHL_STARTER",
    name: "GoHighLevel Starter",
    priceMonthly: 99,
    note: "Starter",
    isPurchasable: true,
    availableForPackageCodes: ["BASIC"],
    includedInPackageCodes: ["PRO", "ELITE"],
  },
  {
    code: "WHITE_LABEL",
    name: "White-Label",
    priceMonthly: 99,
    priceByPackage: { BASIC: 99, PRO: 79 },
    note: "Starter/Pro",
    isPurchasable: true,
    availableForPackageCodes: ["BASIC", "PRO"],
    includedInPackageCodes: ["ELITE"],
  },
  {
    code: "GHL_BASIC_SYNC",
    name: "GoHighLevel Growth",
    priceMonthly: 199,
    priceByPackage: { BASIC: 199, PRO: 99 },
    note: "Starter/Pro",
    isPurchasable: true,
    availableForPackageCodes: ["BASIC", "PRO"],
    includedInPackageCodes: ["ELITE"],
  },
];

function normalizeFeatureItem(item) {
  if (item == null) return null;

  if (typeof item === "string") {
    const label = item.trim();
    return label ? { label, children: [] } : null;
  }

  if (typeof item === "object") {
    const label = String(item.label || item.name || item.title || "").trim();
    if (!label) return null;
    const rawChildren = item.children || item.items || item.subItems || [];
    const children = Array.isArray(rawChildren)
      ? rawChildren.map((child) => String(child).trim()).filter(Boolean)
      : [];
    return { label, children };
  }

  return null;
}

function flattenFeatureGroups(featureGroups = []) {
  const items = [];
  for (const group of featureGroups) {
    if (!group || !Array.isArray(group.items)) continue;
    for (const item of group.items) {
      const normalized = normalizeFeatureItem(item);
      if (!normalized) continue;
      items.push(normalized.label);
      for (const child of normalized.children) items.push(child);
    }
  }
  return items;
}

function normalizeFeatureGroups(featureGroups = []) {
  return featureGroups
    .filter((group) => group && (group.heading || (group.items && group.items.length)))
    .map((group) => ({
      heading: group.heading ? String(group.heading).trim() : null,
      variant: group.variant === "highlight" ? "highlight" : "default",
      items: Array.isArray(group.items)
        ? group.items.map(normalizeFeatureItem).filter(Boolean)
        : [],
    }))
    .filter((group) => group.items.length > 0);
}

/**
 * Build the JSON payload stored in SubscriptionPackage.features.
 */
function buildFeaturesPayload(pkg) {
  const groups = normalizeFeatureGroups(pkg.featureGroups || []);
  return {
    badge: pkg.badge ?? null,
    usersLabel: pkg.usersLabel ?? null,
    includedUsers: pkg.includedUsers ?? null,
    maxUsers: pkg.maxUsers ?? null,
    extraUserPrice: pkg.extraUserPrice ?? null,
    groups,
  };
}

function featuresToStorage(featuresOrPayload) {
  // Legacy: plain string array → newline storage
  if (Array.isArray(featuresOrPayload)) {
    return featuresOrPayload.join("\n");
  }
  // Structured payload → JSON
  if (featuresOrPayload && typeof featuresOrPayload === "object") {
    return JSON.stringify(featuresOrPayload);
  }
  return featuresOrPayload == null ? null : String(featuresOrPayload);
}

/**
 * Parse DB `features` string into a structured object.
 * Supports:
 * - JSON payload (new)
 * - newline / comma separated legacy strings
 */
function parseStoredFeatures(raw) {
  const empty = {
    badge: null,
    usersLabel: null,
    includedUsers: null,
    maxUsers: null,
    extraUserPrice: null,
    groups: [],
    features: [],
  };

  if (raw == null) return empty;
  const text = String(raw).trim();
  if (!text) return empty;

  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text);

      if (Array.isArray(parsed)) {
        // JSON array of strings or groups
        if (parsed.every((item) => typeof item === "string")) {
          return {
            ...empty,
            features: parsed.map((s) => s.trim()).filter(Boolean),
            groups: parsed.length
              ? [{ heading: null, variant: "default", items: parsed.map((s) => s.trim()).filter(Boolean) }]
              : [],
          };
        }
        const groups = normalizeFeatureGroups(parsed);
        return {
          ...empty,
          groups,
          features: flattenFeatureGroups(groups),
        };
      }

      if (parsed && typeof parsed === "object") {
        const groups = normalizeFeatureGroups(
          parsed.groups || parsed.featureGroups || [],
        );
        return {
          badge: parsed.badge ?? null,
          usersLabel: parsed.usersLabel ?? null,
          includedUsers:
            parsed.includedUsers != null ? Number(parsed.includedUsers) : null,
          maxUsers: parsed.maxUsers != null ? Number(parsed.maxUsers) : null,
          extraUserPrice:
            parsed.extraUserPrice != null ? Number(parsed.extraUserPrice) : null,
          groups,
          features: flattenFeatureGroups(groups),
        };
      }
    } catch {
      // fall through to legacy parsers
    }
  }

  // Heading-marker legacy format: lines starting with "## " are section titles
  if (text.includes("\n")) {
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const groups = [];
    let current = { heading: null, variant: "default", items: [] };

    for (const line of lines) {
      const highlightMatch = line.match(/^##!\s+(.+)$/);
      const headingMatch = line.match(/^##\s+(.+)$/);
      if (highlightMatch || headingMatch) {
        if (current.items.length || current.heading) groups.push(current);
        current = {
          heading: (highlightMatch || headingMatch)[1].trim(),
          variant: highlightMatch ? "highlight" : "default",
          items: [],
        };
        continue;
      }
      current.items.push(line);
    }
    if (current.items.length || current.heading) groups.push(current);

    const hasHeadings = groups.some((g) => g.heading);
    if (hasHeadings) {
      const normalized = normalizeFeatureGroups(groups);
      return {
        ...empty,
        groups: normalized,
        features: flattenFeatureGroups(normalized),
      };
    }

    return {
      ...empty,
      features: lines,
      groups: [{ heading: null, variant: "default", items: lines }],
    };
  }

  const features = text
    .split(/[,;|]/)
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    ...empty,
    features,
    groups: features.length
      ? [{ heading: null, variant: "default", items: features }]
      : [],
  };
}

function packageToSeedData(pkg) {
  const payload = buildFeaturesPayload(pkg);
  return {
    name: pkg.name,
    code: pkg.code,
    priceMonthly: pkg.priceMonthly,
    priceYearly: pkg.priceYearly,
    description: pkg.description,
    features: featuresToStorage(payload),
    usageLimits: pkg.usageLimits,
    sortOrder: pkg.sortOrder,
    isPopular: pkg.isPopular,
    isActive: true,
  };
}

module.exports = {
  SUBSCRIPTION_PACKAGES,
  SUBSCRIPTION_ADD_ONS,
  flattenFeatureGroups,
  normalizeFeatureGroups,
  normalizeFeatureItem,
  buildFeaturesPayload,
  featuresToStorage,
  parseStoredFeatures,
  packageToSeedData,
};
