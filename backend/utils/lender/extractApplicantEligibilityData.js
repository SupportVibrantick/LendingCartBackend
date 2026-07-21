/**
 * Build applicant metrics for lender product eligibility checks from a submission.
 */
function extractApplicantEligibilityData(submission, application) {
  const extractValue = (val) => {
    if (val === null || val === undefined || val === "") return null;
    if (typeof val === "object") {
      return val?.value ?? val?.text ?? val?.label ?? null;
    }
    return val;
  };

  const getFieldValue = (key) => {
    const field = submission.fields.find(
      (f) => f.fieldKey === key || f.builderField?.fieldKey === key,
    );
    return extractValue(field?.value);
  };

  const findFieldValueByKeyPart = (part) => {
    const field = submission.fields.find(
      (f) =>
        String(f.fieldKey || "").includes(part) ||
        String(f.builderField?.fieldKey || "").includes(part),
    );
    return extractValue(field?.value);
  };

  const getFirstFieldValue = (...keys) => {
    for (const key of keys) {
      const value = getFieldValue(key);
      if (value !== null && value !== undefined && value !== "") {
        return value;
      }
    }
    return null;
  };

  const safeNumber = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const loanAmount =
    safeNumber(getFieldValue("amountRequested")) ??
    safeNumber(getFieldValue("loan_amount")) ??
    safeNumber(application?.amountRequested);

  const termMonths =
    safeNumber(getFieldValue("loanTerm")) ??
    safeNumber(getFieldValue("requested_term_months"));

  let creditScore =
    safeNumber(getFieldValue("creditScore")) ??
    safeNumber(getFieldValue("credit_score"));

  if (creditScore === null) {
    const range = getFieldValue("creditScoreRange");
    if (range && typeof range === "string") {
      const minRange = parseInt(range.split("-")[0], 10);
      creditScore = Number.isFinite(minRange) ? minRange : null;
    }
  }

  if (creditScore === null) {
    creditScore =
      safeNumber(findFieldValueByKeyPart("creditScore")) ??
      safeNumber(findFieldValueByKeyPart("credit_score"));
  }

  const similarProjectsRaw =
    getFirstFieldValue("similarProjectsCompleted") ??
    findFieldValueByKeyPart("similarProjectsCompleted");

  const annualRevenue =
    safeNumber(getFieldValue("annualRevenue")) ??
    safeNumber(getFieldValue("annual_revenue")) ??
    safeNumber(findFieldValueByKeyPart("annualRevenue")) ??
    safeNumber(application?.financials?.annualRevenue);

  const purposeRaw =
    getFieldValue("purpose") ??
    getFieldValue("loanPurpose") ??
    application?.purpose ??
    "";
  const isRefinance = /refinance|debt refinanc/i.test(String(purposeRaw));

  const ownerOccupiedRaw = getFirstFieldValue(
    "ownerOccupied",
    "isOwnerOccupied",
    "ownerOccupancy",
  );
  const ownerOccupancyPercent = safeNumber(
    getFieldValue("ownerOccupancyPercent"),
  );

  let ownerOccupied = null;
  if (ownerOccupiedRaw !== null && ownerOccupiedRaw !== undefined && ownerOccupiedRaw !== "") {
    const normalized = String(ownerOccupiedRaw).trim().toLowerCase();
    if (["true", "yes", "1"].includes(normalized)) {
      ownerOccupied = true;
    } else if (["false", "no", "0"].includes(normalized)) {
      ownerOccupied = false;
    } else if (normalized.includes("owner")) {
      ownerOccupied = true;
    } else if (normalized.includes("investment") || normalized.includes("non-owner")) {
      ownerOccupied = false;
    }
  } else if (ownerOccupancyPercent !== null) {
    ownerOccupied = ownerOccupancyPercent >= 51;
  }

  return {
    loanAmount,
    termMonths,
    borrowerMinTerm: safeNumber(getFieldValue("minTermMonths")),
    borrowerMaxTerm: safeNumber(getFieldValue("maxTermMonths")),
    creditScore,
    ltv: safeNumber(getFieldValue("ltvPercentage")),
    ltc: safeNumber(getFieldValue("ltcPercentage")),
    arv: safeNumber(getFieldValue("arvPercentage")),
    dscr: safeNumber(getFieldValue("dscr")),
    debtYield:
      safeNumber(getFieldValue("debtYield")) ??
      safeNumber(getFieldValue("minDebtYield")),
    netWorth: safeNumber(getFieldValue("netWorth")),
    interestRate:
      safeNumber(getFieldValue("interestRate")) ??
      safeNumber(getFieldValue("expectedInterestRate")),
    propertyType: getFieldValue("propertyType"),
    propertyState: getFieldValue("propertyState"),
    businessIndustry:
      getFieldValue("business_industry") ?? getFieldValue("businessIndustry"),
    yearsInBusiness: safeNumber(getFieldValue("yearsInBusiness")),
    numberOfUnits: safeNumber(getFieldValue("numberOfUnits")),
    similarProjectsCompleted: safeNumber(similarProjectsRaw) ?? similarProjectsRaw,
    portfolioPropertyCount: safeNumber(getFieldValue("portfolioPropertyCount")),
    annualRevenue,
    isRefinance,
    ownerOccupied,
  };
}

module.exports = {
  extractApplicantEligibilityData,
};
