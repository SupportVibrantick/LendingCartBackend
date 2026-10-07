/** Marketing feature groups for Loan AI pricing cards (aligned with seed catalog). */

export type PackageFeatureItem =
  | string
  | { label: string; children: string[] };

export type PackageFeatureGroup = {
  heading: string | null;
  variant?: "default" | "highlight";
  items: PackageFeatureItem[];
};

function itemId(item: PackageFeatureItem, parentLabel?: string): string {
  if (typeof item === "string") {
    return `s:${item}`;
  }
  if (parentLabel) {
    return `c:${parentLabel}::${item.label}`;
  }
  return `p:${item.label}`;
}

export function flattenItemIds(items: PackageFeatureItem[]): string[] {
  const ids: string[] = [];
  for (const item of items) {
    if (typeof item === "string") {
      ids.push(itemId(item));
      continue;
    }
    ids.push(itemId(item));
    for (const child of item.children || []) {
      ids.push(`c:${item.label}::${child}`);
    }
  }
  return ids;
}

export function groupsToSelectedIds(groups: PackageFeatureGroup[]): Set<string> {
  const set = new Set<string>();
  for (const group of groups) {
    for (const id of flattenItemIds(group.items || [])) {
      set.add(id);
    }
  }
  return set;
}

export function selectedIdsToGroups(
  library: PackageFeatureGroup[],
  selected: Set<string>,
): PackageFeatureGroup[] {
  const out: PackageFeatureGroup[] = [];

  for (const section of library) {
    const items: PackageFeatureItem[] = [];

    for (const item of section.items) {
      if (typeof item === "string") {
        if (selected.has(itemId(item))) items.push(item);
        continue;
      }

      const childSelected = (item.children || []).filter((c) =>
        selected.has(`c:${item.label}::${c}`),
      );
      const parentOn = selected.has(itemId(item));

      if (parentOn && childSelected.length === 0) {
        items.push({ label: item.label, children: [...(item.children || [])] });
      } else if (childSelected.length > 0) {
        items.push({ label: item.label, children: childSelected });
      } else if (parentOn) {
        items.push({ label: item.label, children: [] });
      }
    }

    if (items.length > 0) {
      out.push({
        heading: section.heading,
        variant: section.variant,
        items,
      });
    }
  }

  return out;
}

export const PACKAGE_FEATURE_LIBRARY: PackageFeatureGroup[] = [
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
];

export const PACKAGE_FEATURE_TEMPLATES: Record<
  string,
  { label: string; groups: PackageFeatureGroup[] }
> = {
  BASIC: {
    label: "Starter (BASIC)",
    groups: [PACKAGE_FEATURE_LIBRARY[0]],
  },
  PRO: {
    label: "Pro",
    groups: [
      PACKAGE_FEATURE_LIBRARY[0],
      PACKAGE_FEATURE_LIBRARY[1],
      PACKAGE_FEATURE_LIBRARY[2],
    ],
  },
  ELITE: {
    label: "Elite",
    groups: PACKAGE_FEATURE_LIBRARY,
  },
};

export { itemId };
