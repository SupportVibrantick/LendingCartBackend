const {
  mergeMissingFeeAgreementFields,
  resolveFeeAgreementSnapshot,
} = require("./feeAgreementFieldResolver");

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
  } = require("../messaging/resolveClientDisplayName");

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
  } = require("../messaging/resolveClientDisplayName");

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
  } = require("../messaging/resolveClientDisplayName");

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
  resolvedSnapshot = null,
) {
  if (!feeAgreement) return null;

  const {
    resolveAgreementBranding,
  } = require("../broker/brokerBranding");

  const enrichedLoanApplication = loanApplication
    ? enrichLoanApplicationClient(loanApplication)
    : null;

  const brokerOrg = loanApplication?.brokerOrg || null;
  const brokerUser = loanApplication?.brokerUser || null;

  const brokerUserName = brokerUser
    ? `${brokerUser.firstName || ""} ${brokerUser.lastName || ""}`.trim()
    : null;

  let resolved = resolvedSnapshot;
  if (!resolved && loanApplication) {
    const submission =
      loanApplication.submissions?.[0] ||
      loanApplication.applicationSubmissions?.[0] ||
      null;

    if (submission) {
      resolved = resolveFeeAgreementSnapshot({
        loanApplication,
        submission,
        primaryContact: loanApplication.client?.contacts?.[0] || null,
        orgBrokerUser: loanApplication.orgBrokerUser || null,
      });
    }
  }

  const mergedAgreement = resolved
    ? mergeMissingFeeAgreementFields(feeAgreement, resolved)
    : feeAgreement;

  const brokerName = coalesce(
    isBlank(mergedAgreement.brokerName) ? null : mergedAgreement.brokerName,
    brokerUserName,
    brokerOrg?.name,
  );

  const branding = resolveAgreementBranding(feeAgreement, whiteLabelBranding);

  const clientAddress = coalesce(
    mergedAgreement.clientAddress,
    mergedAgreement.subjectAddress,
  );

  return {
    ...feeAgreement,
    ...(enrichedLoanApplication
      ? { loanApplication: enrichedLoanApplication }
      : {}),
    brokerLogoUrl: branding.brokerLogoUrl,
    brokerBrandName: branding.brokerBrandName,
    clientName: resolveStoredClientName(mergedAgreement, loanApplication),
    clientEntityName: resolveStoredClientEntityName(mergedAgreement, loanApplication),
    clientEmail: coalesce(
      mergedAgreement.clientEmail,
      loanApplication?.client?.contacts?.[0]?.email,
    ),
    clientPhone: coalesce(
      mergedAgreement.clientPhone,
      loanApplication?.client?.contacts?.[0]?.phone,
    ),
    brokerName,
    brokerCompany: coalesce(mergedAgreement.brokerCompany, brokerOrg?.name),
    brokerEmail: coalesce(
      mergedAgreement.brokerEmail,
      brokerUser?.email,
      brokerOrg?.email,
    ),
    brokerPhone: coalesce(
      mergedAgreement.brokerPhone,
      brokerUser?.phone,
      brokerOrg?.phone,
    ),
    brokerAddress: coalesce(mergedAgreement.brokerAddress),
    brokerState: coalesce(mergedAgreement.brokerState),
    brokerCounty: coalesce(mergedAgreement.brokerCounty),
    subjectAddress: coalesce(mergedAgreement.subjectAddress),
    clientAddress: coalesce(clientAddress),
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

const BROKER_POINTS_MAX = 100;
const UPFRONT_FEE_MAX = 99_999_999.99;
const EXCLUSIVITY_MONTHS_MAX = 360;

function parseFeeNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return numeric;
}

function validateFeeAgreementTerms({ brokerPoints, upfrontFee, exclusivityMonths }) {
  const errors = [];

  if (brokerPoints !== undefined && brokerPoints !== null && brokerPoints !== "") {
    const numeric = parseFeeNumber(brokerPoints);
    if (numeric === null) {
      errors.push("Broker fee must be a valid percentage.");
    } else if (numeric < 0 || numeric > BROKER_POINTS_MAX) {
      errors.push(
        `Broker fee must be between 0 and ${BROKER_POINTS_MAX} percent.`,
      );
    }
  }

  if (upfrontFee !== undefined && upfrontFee !== null && upfrontFee !== "") {
    const numeric = parseFeeNumber(upfrontFee);
    if (numeric === null) {
      errors.push("Upfront fee must be a valid amount.");
    } else if (numeric < 0 || numeric > UPFRONT_FEE_MAX) {
      errors.push(
        `Upfront fee must be between 0 and ${UPFRONT_FEE_MAX.toLocaleString("en-US")}.`,
      );
    }
  }

  if (
    exclusivityMonths !== undefined &&
    exclusivityMonths !== null &&
    exclusivityMonths !== ""
  ) {
    const numeric = parseFeeNumber(exclusivityMonths);
    if (numeric === null || !Number.isInteger(numeric)) {
      errors.push("Exclusivity months must be a whole number.");
    } else if (numeric <= 0 || numeric > EXCLUSIVITY_MONTHS_MAX) {
      errors.push(
        `Exclusivity months must be between 1 and ${EXCLUSIVITY_MONTHS_MAX}.`,
      );
    }
  }

  return errors;
}

function normalizeFeeAgreementTerms({ brokerPoints, upfrontFee, exclusivityMonths }) {
  return {
    brokerPoints:
      brokerPoints === undefined
        ? undefined
        : brokerPoints === null
          ? null
          : Math.round(parseFeeNumber(brokerPoints) * 100) / 100,
    upfrontFee:
      upfrontFee === undefined
        ? undefined
        : upfrontFee === null
          ? null
          : Math.round(parseFeeNumber(upfrontFee) * 100) / 100,
    exclusivityMonths:
      exclusivityMonths === undefined
        ? undefined
        : exclusivityMonths === null
          ? null
          : Math.trunc(parseFeeNumber(exclusivityMonths)),
  };
}

module.exports = {
  isBlank,
  coalesce,
  isFeeTermConfigured,
  canClientSignFeeAgreement,
  normalizeFeeAgreement,
  validateFeeAgreementTerms,
  normalizeFeeAgreementTerms,
  BROKER_POINTS_MAX,
  UPFRONT_FEE_MAX,
  EXCLUSIVITY_MONTHS_MAX,
};
