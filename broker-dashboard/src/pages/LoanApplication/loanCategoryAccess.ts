/**
 * Loan category ↔ subscription plan gating for the application UI.
 * Keep in sync with backend `defaultFeaturesForPackage` (brokerOrgFeatures.js):
 * - BASIC/Starter: RESIDENTIAL_1_4 only (CRE via CRE_PACK add-on)
 * - PRO: + CRE_MULTIFAMILY
 * - ELITE: + SBA_USDA + ABL
 */

export type LoanCategoryCode =
  | "RESIDENTIAL_1_4"
  | "CRE_MULTIFAMILY"
  | "SBA_USDA"
  | "ABL";

export const ALL_LOAN_CATEGORIES: LoanCategoryCode[] = [
  "RESIDENTIAL_1_4",
  "CRE_MULTIFAMILY",
  "SBA_USDA",
  "ABL",
];

/** Minimum plan that includes the category (marketing label for UI tags). */
export const LOAN_CATEGORY_PLAN_TAG: Record<
  LoanCategoryCode,
  "Starter" | "Pro" | "Elite" | null
> = {
  RESIDENTIAL_1_4: null,
  CRE_MULTIFAMILY: "Pro",
  SBA_USDA: "Elite",
  ABL: "Elite",
};

export function getLoanCategoryPlanTag(
  category: string,
): "Starter" | "Pro" | "Elite" | null {
  return (
    LOAN_CATEGORY_PLAN_TAG[category as LoanCategoryCode] ?? null
  );
}

/**
 * Whether the org may select this category.
 * Fail closed: missing/empty allowed list → only Residential.
 */
export function isLoanCategoryAllowed(
  category: string,
  allowedCategories?: string[] | null,
): boolean {
  if (category === "RESIDENTIAL_1_4") {
    if (!allowedCategories || allowedCategories.length === 0) return true;
    return allowedCategories.includes("RESIDENTIAL_1_4");
  }
  if (!allowedCategories || allowedCategories.length === 0) return false;
  return allowedCategories.includes(category);
}
