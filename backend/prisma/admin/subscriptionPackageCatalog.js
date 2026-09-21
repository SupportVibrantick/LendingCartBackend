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
 *   groups: [{ heading, items: string[], variant?: "default" | "highlight" }]
 * }
 */

const SUBSCRIPTION_PACKAGES = [
  {
    name: "Basic",
    code: "BASIC",
    priceMonthly: 199,
    priceYearly: 1990,
    description: "For independent brokers getting started",
    badge: null,
    usersLabel: "1 User · Add up to 10 ($100/user)",
    includedUsers: 1,
    maxUsers: 10,
    extraUserPrice: 100,
    featureGroups: [
      {
        heading: "CORE PLATFORM",
        items: [
          "Unlimited Borrowers",
          "Web-Based Loan Application",
          "Broker Portal",
          "Client Portal",
          "Loan Pipeline & Dashboard",
          "Performance Dashboard",
          "Loan Status & Doc Upload Portal",
        ],
      },
      {
        heading: "LOAN PRODUCTS & LENDERS",
        items: [
          "Bridge, DSCR, Fix & Flip, Construction (1-4 unit)",
          "20+ Lenders Network",
          "Lender Matching Tool",
        ],
      },
      {
        heading: "CLOSING & COMMUNICATION",
        items: [
          "Fee Agreement & E-Signatures",
          "Basic Website Builder (single page)",
          "Document Request, Upload & Send to Lender",
          "Email Notifications & Reminders",
          "Email Support",
        ],
      },
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
    description: "For growing brokerages with a team",
    badge: "MOST POPULAR",
    usersLabel: "3 Users · Add up to 25 ($100/user)",
    includedUsers: 3,
    maxUsers: 25,
    extraUserPrice: 100,
    featureGroups: [
      {
        heading: "EVERYTHING IN BASIC, PLUS:",
        items: [
          "Unlimited Co-Brokers",
          "CRE, Agency, CMBS, Mezz/Pref Products",
          "40+ Lenders + Lender Marketplace",
          "Add Your Own Lenders",
          "Basic CRM Included",
        ],
      },
      {
        heading: "MULTI-PORTAL & BRANDING",
        items: [
          "Co-Broker Portals",
          "Loan Officer Portals",
          "White Labeling (Logo & Brand Name)",
          "Full Website Builder (multi-page, custom)",
        ],
      },
      {
        heading: "ADVANCED FEATURES",
        items: [
          "LOI / Term Sheet Workflow",
          "Custom Document Types",
          "Email Marketing Campaigns",
          "Commission Tracking",
          "In-App Chat on Deals",
          "Pre-Underwriting Checklist",
          "Auto Deal Summary (PDF for lenders)",
          "Document Activity Timeline",
          "Platform Reports & Analytics",
        ],
      },
      {
        heading: "SUPPORT",
        items: ["Priority Support"],
      },
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
    priceMonthly: 699,
    priceYearly: 6990,
    description: "For teams at scale + full GHL suite",
    badge: "BEST VALUE",
    usersLabel: "5 Users · Add up to 100 ($100/user)",
    includedUsers: 5,
    maxUsers: 100,
    extraUserPrice: 100,
    featureGroups: [
      {
        heading: "EVERYTHING IN PRO, PLUS:",
        items: [
          "All Lending Products (SBA, USDA, Asset-Based)",
          "100+ Lenders Network",
          "Advanced CRM (Contacts & Borrowers)",
          "Advanced Document Automation",
          "Auto-Forward Documents to Lender & Client",
          "White-Label Custom Domain (Coming Soon)",
          "Dedicated Account Manager",
        ],
      },
      {
        heading: "Advanced GHL Integrations",
        variant: "highlight",
        items: [
          "GHL Advanced CRM (Done-For-You)",
          "Social Media Integration & Campaigns",
          "All Social Media Posts in One Click",
          "Email & SMS (Pre-Built Campaigns)",
          "Advanced Workflow Automation",
          "Unlimited Websites + Funnels",
          "Advanced Calendar Integration",
          "Unlimited Webinars & Funnels",
          "AI Appointment Setup Agent",
          "Voice AI Agents (Inbound & Outbound)",
          "Custom Domain",
        ],
      },
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
    name: "Additional Users",
    priceMonthly: 100,
    isPurchasable: true,
    usageBoost: { ACTIVE_USERS: 1 },
    quantityBased: true,
  },
  {
    code: "CRE_PACK",
    name: "CRE & Multifamily",
    priceMonthly: 50,
    note: "Basic",
    isPurchasable: true,
    availableForPackageCodes: ["BASIC"],
    includedInPackageCodes: ["PRO", "ELITE"],
  },
  {
    code: "ABL_PACK",
    name: "Asset-Based Lending",
    priceMonthly: 50,
    note: "Basic/Pro",
    isPurchasable: true,
    availableForPackageCodes: ["BASIC", "PRO"],
    includedInPackageCodes: ["ELITE"],
  },
  {
    code: "SBA_PACK",
    name: "SBA & USDA",
    priceMonthly: 50,
    note: "Basic/Pro",
    isPurchasable: true,
    availableForPackageCodes: ["BASIC", "PRO"],
    includedInPackageCodes: ["ELITE"],
  },
  {
    code: "GHL_BASIC_SYNC",
    name: "GHL Basic Sync",
    priceMonthly: 100,
    note: "Pro",
    isPurchasable: true,
    availableForPackageCodes: ["PRO"],
    includedInPackageCodes: ["ELITE"],
  },
  {
    code: "WHITE_LABEL",
    name: "White-Labeling",
    priceMonthly: 50,
    note: "Basic",
    isPurchasable: true,
    availableForPackageCodes: ["BASIC"],
    includedInPackageCodes: ["PRO", "ELITE"],
  },
];

function flattenFeatureGroups(featureGroups = []) {
  const items = [];
  for (const group of featureGroups) {
    if (!group) continue;
    if (Array.isArray(group.items)) {
      for (const item of group.items) {
        if (item != null && String(item).trim()) items.push(String(item).trim());
      }
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
        ? group.items.map((item) => String(item).trim()).filter(Boolean)
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
  buildFeaturesPayload,
  featuresToStorage,
  parseStoredFeatures,
  packageToSeedData,
};
