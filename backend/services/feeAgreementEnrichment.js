function isBlank(value) {
  if (value === null || value === undefined) return true;
  const text = String(value).trim();
  if (!text) return true;
  const lower = text.toLowerCase();
  return lower === "n/a" || lower === "na" || text === "—" || text === "-";
}

function coalesce(...values) {
  for (const value of values) {
    if (!isBlank(value)) return value;
  }
  return null;
}

function isFeeTermConfigured(value) {
  if (value === null || value === undefined || value === "") return false;
  return Number.isFinite(Number(value));
}

function canClientSignFeeAgreement(agreement) {
  if (!agreement) return false;

  if (!isFeeTermConfigured(agreement.brokerPoints)) return false;
  if (!isFeeTermConfigured(agreement.upfrontFee)) return false;
  if (!isFeeTermConfigured(agreement.exclusivityMonths)) return false;

  const exclusivityMonths = Number(agreement.exclusivityMonths);
  return Number.isFinite(exclusivityMonths) && exclusivityMonths > 0;
}

function resolveStoredClientEntityName(feeAgreement, loanApplication = null) {
  const {
    resolveClientEntityLabelFromData,
    isPlaceholderName,
  } = require("./resolveClientDisplayName");

  const stored = feeAgreement?.clientEntityName;
  if (stored && !isPlaceholderName(stored)) {
    return stored;
  }

  if (!loanApplication?.client) {
    return isPlaceholderName(stored) ? null : stored || null;
  }

  return (
    resolveClientEntityLabelFromData(
      loanApplication.client,
      loanApplication.submissions || [],
    ) || null
  );
}

function resolveStoredClientName(feeAgreement, loanApplication = null) {
  const {
    resolveClientDisplayNameFromData,
    isPlaceholderName,
  } = require("./resolveClientDisplayName");

  const stored = feeAgreement?.clientName;
  if (stored && !isPlaceholderName(stored)) {
    return stored;
  }

  if (!loanApplication?.client) {
    return isPlaceholderName(stored) ? null : stored || null;
  }

  return resolveClientDisplayNameFromData(
    loanApplication.client,
    loanApplication.submissions || [],
  );
}

function enrichLoanApplicationClient(loanApplication) {
  if (!loanApplication?.client) return loanApplication;

  const {
    resolveClientDisplayNameFromData,
    resolveClientEntityLabelFromData,
    isPlaceholderName,
  } = require("./resolveClientDisplayName");

  const submissions = loanApplication.submissions || [];
  const client = loanApplication.client;
  const displayName = resolveClientDisplayNameFromData(client, submissions);
  const entityLabel = resolveClientEntityLabelFromData(client, submissions);

  return {
    ...loanApplication,
    client: {
      ...client,
      legalName: isPlaceholderName(client.legalName) ? displayName : client.legalName,
      entityLabel: entityLabel || null,
    },
  };
}

function normalizeFeeAgreement(
  feeAgreement,
  loanApplication = null,
  whiteLabelBranding = null,
) {
  if (!feeAgreement) return null;

  const {
    resolveAgreementBranding,
  } = require("./brokerBranding");

  const enrichedLoanApplication = loanApplication
    ? enrichLoanApplicationClient(loanApplication)
    : null;

  const brokerOrg = loanApplication?.brokerOrg || null;
  const brokerUser = loanApplication?.brokerUser || null;

  const brokerUserName = brokerUser
    ? `${brokerUser.firstName || ""} ${brokerUser.lastName || ""}`.trim()
    : null;

  const brokerName = coalesce(
    isBlank(feeAgreement.brokerName) ? null : feeAgreement.brokerName,
    brokerUserName,
    brokerOrg?.name,
  );

  const branding = resolveAgreementBranding(feeAgreement, whiteLabelBranding);

  return {
    ...feeAgreement,
    ...(enrichedLoanApplication
      ? { loanApplication: enrichedLoanApplication }
      : {}),
    brokerLogoUrl: branding.brokerLogoUrl,
    brokerBrandName: branding.brokerBrandName,
    clientName: resolveStoredClientName(feeAgreement, loanApplication),
    clientEntityName: resolveStoredClientEntityName(feeAgreement, loanApplication),
    clientEmail: coalesce(
      feeAgreement.clientEmail,
      loanApplication?.client?.contacts?.[0]?.email,
    ),
    clientPhone: coalesce(
      feeAgreement.clientPhone,
      loanApplication?.client?.contacts?.[0]?.phone,
    ),
    brokerName,
    brokerCompany: coalesce(feeAgreement.brokerCompany, brokerOrg?.name),
    brokerEmail: coalesce(
      feeAgreement.brokerEmail,
      brokerUser?.email,
      brokerOrg?.email,
    ),
    brokerPhone: coalesce(
      feeAgreement.brokerPhone,
      brokerUser?.phone,
      brokerOrg?.phone,
    ),
    brokerAddress: isBlank(feeAgreement.brokerAddress) ? null : feeAgreement.brokerAddress,
    brokerState: isBlank(feeAgreement.brokerState) ? null : feeAgreement.brokerState,
    brokerCounty: isBlank(feeAgreement.brokerCounty) ? null : feeAgreement.brokerCounty,
    subjectAddress: isBlank(feeAgreement.subjectAddress)
      ? null
      : feeAgreement.subjectAddress,
    clientAddress: isBlank(feeAgreement.clientAddress)
      ? null
      : feeAgreement.clientAddress,
    brokerPoints:
      feeAgreement.brokerPoints === null || feeAgreement.brokerPoints === undefined
        ? null
        : feeAgreement.brokerPoints,
    upfrontFee:
      feeAgreement.upfrontFee === null || feeAgreement.upfrontFee === undefined
        ? null
        : feeAgreement.upfrontFee,
    exclusivityMonths:
      feeAgreement.exclusivityMonths === null ||
      feeAgreement.exclusivityMonths === undefined
        ? null
        : feeAgreement.exclusivityMonths,
  };
}

module.exports = {
  isBlank,
  coalesce,
  isFeeTermConfigured,
  canClientSignFeeAgreement,
  normalizeFeeAgreement,
};
