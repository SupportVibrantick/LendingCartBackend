const {
  getOrgEnabledFeatures,
  resolveLoanCategoryForAccess,
  assertLoanAccessAllowed,
} = require("../../services/subscription/brokerOrgFeatures");

/**
 * Public-safe loan category/type entitlements for a broker org
 * (shared application link / embedded form).
 */
async function getPublicLoanEntitlements(prisma, organizationId) {
  if (!organizationId) {
    return {
      loanCategories: [],
      loanTypes: [],
      packageCode: null,
      feeAgreementEnabled: false,
    };
  }

  const entitlements = await getOrgEnabledFeatures(prisma, organizationId);
  const features = entitlements.features || [];
  return {
    loanCategories: entitlements.loanCategories || [],
    loanTypes: entitlements.loanTypes || [],
    packageCode: entitlements.subscription?.package?.code || null,
    feeAgreementEnabled: features.includes("VIEW_FEE_AGREEMENT"),
  };
}

/**
 * Enforce org plan loan access on public application submit.
 * @returns {null | { status: number, message: string }}
 */
async function assertPublicLoanAccess(prisma, brokerOrgId, {
  loanProductCode,
  fields,
} = {}) {
  const entitlements = await getOrgEnabledFeatures(prisma, brokerOrgId);
  const explicitCategory = Array.isArray(fields)
    ? fields.find((f) => f?.fieldKey === "loanCategory")?.value
    : null;
  const loanCategory = resolveLoanCategoryForAccess({
    loanCategory: explicitCategory,
    loanType: loanProductCode,
  });
  const loanAccess = assertLoanAccessAllowed(entitlements.features, {
    loanCategory,
    loanType: loanProductCode,
  });
  if (!loanAccess.ok) {
    return { status: 403, message: loanAccess.message };
  }
  return null;
}

module.exports = {
  getPublicLoanEntitlements,
  assertPublicLoanAccess,
};
