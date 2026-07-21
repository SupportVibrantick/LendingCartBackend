const { getProductEligibilityRules } = require("../lender/lenderProductCriteria");

const STATE_NAME_TO_CODE = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
  "district of columbia": "DC",
};

const CODE_TO_STATE_NAME = Object.fromEntries(
  Object.entries(STATE_NAME_TO_CODE).map(([name, code]) => [code, name]),
);

const toPositiveNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const normalizeToken = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const normalizeStateToken = (value) => {
  const token = normalizeToken(value);
  if (!token) return "";

  if (token.length === 2) {
    return token.toUpperCase();
  }

  return STATE_NAME_TO_CODE[token] || token.toUpperCase();
};

const parseStatesSupported = (value) => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeStateToken(entry))
      .filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        return parseStatesSupported(parsed);
      } catch {
        return [];
      }
    }

    return trimmed
      .split(",")
      .map((entry) => normalizeStateToken(entry))
      .filter(Boolean);
  }

  return [];
};

const flattenGroupedSelections = (value) => {
  if (!value) return [];

  let parsed = value;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return [normalizeToken(trimmed)];
    }
  }

  if (Array.isArray(parsed)) {
    return parsed
      .flatMap((entry) => {
        if (typeof entry === "string") {
          return [normalizeToken(entry)];
        }

        if (!entry || typeof entry !== "object") {
          return [];
        }

        const label = normalizeToken(
          entry.name || entry.type || entry.value || entry.label,
        );
        const subTypes = Array.isArray(entry.subTypes)
          ? entry.subTypes.map((subType) => normalizeToken(subType))
          : [];

        return [label, ...subTypes].filter(Boolean);
      })
      .filter(Boolean);
  }

  if (typeof parsed === "object") {
    return Object.entries(parsed).flatMap(([group, subTypes]) => {
      const tokens = [normalizeToken(group)];

      if (Array.isArray(subTypes)) {
        tokens.push(...subTypes.map((subType) => normalizeToken(subType)));
      }

      return tokens.filter(Boolean);
    });
  }

  return [];
};

const parseIndustries = (value) => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeToken(entry)).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => normalizeToken(entry))
      .filter(Boolean);
  }

  return [];
};

const matchesSelection = (configuredValues, applicantValue) => {
  const normalizedApplicant = normalizeToken(applicantValue);
  if (!normalizedApplicant || configuredValues.length === 0) {
    return true;
  }

  return configuredValues.some(
    (configured) =>
      configured === normalizedApplicant ||
      normalizedApplicant.includes(configured) ||
      configured.includes(normalizedApplicant),
  );
};

const PROPERTY_TYPE_APPLICANT_ALIASES = {
  "single family (1-unit)": [
    "single family (1-4 units)",
    "single family detached",
    "single family",
    "1-unit",
  ],
  "duplex (2-unit)": ["duplex", "single family (1-4 units)", "2-unit"],
  "triplex (3-unit)": ["triplex", "single family (1-4 units)", "3-unit"],
  "fourplex (4-unit)": ["fourplex", "single family (1-4 units)", "4-unit"],
  "condo / townhome": ["condo", "townhome", "townhouse"],
};

const expandApplicantSelectionTokens = (applicantValue) => {
  const normalizedApplicant = normalizeToken(applicantValue);
  if (!normalizedApplicant) {
    return [];
  }

  const aliases = PROPERTY_TYPE_APPLICANT_ALIASES[normalizedApplicant] || [];
  return [normalizedApplicant, ...aliases];
};

const matchesPropertyTypeSelection = (configuredValues, applicantValue) => {
  if (!applicantValue || configuredValues.length === 0) {
    return true;
  }

  const applicantTokens = expandApplicantSelectionTokens(applicantValue);

  return applicantTokens.some((applicantToken) =>
    configuredValues.some(
      (configured) =>
        configured === applicantToken ||
        applicantToken.includes(configured) ||
        configured.includes(applicantToken),
    ),
  );
};

const resolveFundingRange = (lenderProduct, lenderProfile) => {
  const minLoan =
    toPositiveNumber(lenderProduct?.minLoanAmount) ??
    toPositiveNumber(lenderProfile?.minFunding);

  const maxLoan =
    toPositiveNumber(lenderProduct?.maxLoanAmount) ??
    toPositiveNumber(lenderProfile?.maxFunding);

  return { minLoan, maxLoan };
};

const resolveSupportedStates = (lenderProduct, lenderProfile) => {
  const productStates = parseStatesSupported(lenderProduct?.statesSupported);
  if (productStates.length > 0) {
    return productStates;
  }

  return parseStatesSupported(lenderProfile?.statesSupported);
};

const resolveBusinessTypes = (lenderProduct, lenderProfile) => {
  const productBusinessTypes = flattenGroupedSelections(
    lenderProduct?.businessTypes,
  );
  if (productBusinessTypes.length > 0) {
    return productBusinessTypes;
  }

  return parseIndustries(lenderProfile?.industries);
};

const hasConfiguredNumber = (value) => {
  if (value === null || value === undefined || value === "") {
    return false;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed);
};

const parseInterestRateRange = (rangeStr) => {
  if (!rangeStr) {
    return { min: null, max: null };
  }

  const match = String(rangeStr).match(/([\d.]+)\s*-\s*([\d.]+)/);
  if (!match) {
    return { min: null, max: null };
  }

  return {
    min: Number(match[1]),
    max: Number(match[2]),
  };
};

const formatLenderInterestRate = (lenderProduct) => {
  if (lenderProduct?.interestRateRange) {
    return lenderProduct.interestRateRange;
  }

  const min = lenderProduct?.minRateSpreadPercent;
  const max = lenderProduct?.maxRateSpreadPercent;

  if (min != null && max != null) {
    return `Prime + ${Number(min)}% to Prime + ${Number(max)}%`;
  }

  if (min != null) {
    return `Prime + ${Number(min)}%`;
  }

  if (max != null) {
    return `Prime + ${Number(max)}%`;
  }

  return null;
};

const isFirstTimeBorrower = (similarProjectsCompleted) => {
  if (similarProjectsCompleted === null || similarProjectsCompleted === undefined) {
    return true;
  }

  const parsed = Number(similarProjectsCompleted);
  if (Number.isFinite(parsed)) {
    return parsed <= 0;
  }

  return String(similarProjectsCompleted).trim() === "0";
};

function evaluateLenderProductEligibility(lenderProduct, applicant, lenderProfile) {
  const reasons = [];
  const productCode = lenderProduct?.loanProductCode;
  const rules = getProductEligibilityRules(productCode);

  const { minLoan, maxLoan } = resolveFundingRange(
    lenderProduct,
    lenderProfile,
  );

  if (rules.checkMinLoanAmount && applicant.loanAmount !== null) {
    if (minLoan && applicant.loanAmount < minLoan) {
      reasons.push(`Loan below minimum (${minLoan})`);
    }
  }

  if (rules.checkMaxLoanAmount && applicant.loanAmount !== null) {
    if (maxLoan && applicant.loanAmount > maxLoan) {
      reasons.push(`Loan exceeds maximum (${maxLoan})`);
    }
  }

  if (
    rules.checkMaxTotalProjectAmount &&
    applicant.loanAmount !== null &&
    hasConfiguredNumber(lenderProduct.maxTotalProjectAmount)
  ) {
    const maxProject = Number(lenderProduct.maxTotalProjectAmount);
    if (applicant.loanAmount > maxProject) {
      reasons.push(`Total project amount exceeds maximum (${maxProject})`);
    }
  }

  if (
    rules.checkMaxSba504DebentureAmount &&
    applicant.loanAmount !== null &&
    hasConfiguredNumber(lenderProduct.maxSba504DebentureAmount)
  ) {
    const maxDebenture = Number(lenderProduct.maxSba504DebentureAmount);
    if (applicant.loanAmount > maxDebenture) {
      reasons.push(`SBA 504 debenture exceeds maximum (${maxDebenture})`);
    }
  }

  if (rules.checkTermMonths && applicant.termMonths !== null) {
    if (
      lenderProduct.minTermMonths &&
      applicant.termMonths < lenderProduct.minTermMonths
    ) {
      reasons.push(
        `Term below minimum (${lenderProduct.minTermMonths} months)`,
      );
    }

    if (
      lenderProduct.maxTermMonths &&
      applicant.termMonths > lenderProduct.maxTermMonths
    ) {
      reasons.push(
        `Term exceeds maximum (${lenderProduct.maxTermMonths} months)`,
      );
    }
  }

  if (
    rules.checkCreditScore &&
    applicant.creditScore !== null &&
    lenderProduct.minCreditScore
  ) {
    if (applicant.creditScore < lenderProduct.minCreditScore) {
      reasons.push(
        `Credit score below minimum (${lenderProduct.minCreditScore})`,
      );
    }
  }

  if (
    rules.checkLtv &&
    applicant.ltv !== null &&
    hasConfiguredNumber(lenderProduct.maxLtvPercent) &&
    applicant.ltv > Number(lenderProduct.maxLtvPercent)
  ) {
    reasons.push(`LTV exceeds maximum (${lenderProduct.maxLtvPercent}%)`);
  }

  if (rules.checkMezzLtv && applicant.ltv !== null) {
    if (
      hasConfiguredNumber(lenderProduct.minMezzLtvPercent) &&
      applicant.ltv < Number(lenderProduct.minMezzLtvPercent)
    ) {
      reasons.push(
        `LTV below mezzanine minimum (${lenderProduct.minMezzLtvPercent}%)`,
      );
    }

    if (
      hasConfiguredNumber(lenderProduct.maxMezzLtvPercent) &&
      applicant.ltv > Number(lenderProduct.maxMezzLtvPercent)
    ) {
      reasons.push(
        `LTV exceeds mezzanine maximum (${lenderProduct.maxMezzLtvPercent}%)`,
      );
    }
  }

  if (
    rules.checkLtc &&
    applicant.ltc !== null &&
    hasConfiguredNumber(lenderProduct.maxLtcPercent) &&
    applicant.ltc > Number(lenderProduct.maxLtcPercent)
  ) {
    reasons.push(`LTC exceeds maximum (${lenderProduct.maxLtcPercent}%)`);
  }

  if (
    rules.checkArv &&
    applicant.arv !== null &&
    hasConfiguredNumber(lenderProduct.maxArvPercent) &&
    applicant.arv > Number(lenderProduct.maxArvPercent)
  ) {
    reasons.push(`ARV exceeds maximum (${lenderProduct.maxArvPercent}%)`);
  }

  if (
    rules.checkDscr &&
    applicant.dscr !== null &&
    hasConfiguredNumber(lenderProduct.minDscr) &&
    applicant.dscr < Number(lenderProduct.minDscr)
  ) {
    reasons.push(`DSCR below minimum (${lenderProduct.minDscr})`);
  }

  if (
    rules.checkMinDebtYield &&
    applicant.debtYield !== null &&
    hasConfiguredNumber(lenderProduct.minDebtYieldPercent) &&
    applicant.debtYield < Number(lenderProduct.minDebtYieldPercent)
  ) {
    reasons.push(
      `Debt yield below minimum (${lenderProduct.minDebtYieldPercent}%)`,
    );
  }

  if (rules.checkInterestRate && applicant.interestRate !== null) {
    const { min, max } = parseInterestRateRange(lenderProduct.interestRateRange);

    if (min !== null && applicant.interestRate < min) {
      reasons.push(`Interest rate below lender minimum (${min}%)`);
    }

    if (max !== null && applicant.interestRate > max) {
      reasons.push(`Interest rate exceeds lender maximum (${max}%)`);
    }
  }

  const supportedStates = resolveSupportedStates(
    lenderProduct,
    lenderProfile,
  );

  if (rules.checkPropertyState && applicant.propertyState && supportedStates.length > 0) {
    const normalizedApplicantState = normalizeStateToken(
      applicant.propertyState,
    );

    if (!supportedStates.includes(normalizedApplicantState)) {
      const stateLabel =
        CODE_TO_STATE_NAME[normalizedApplicantState] || applicant.propertyState;
      reasons.push(`Property state not supported (${stateLabel})`);
    }
  }

  const lenderPropertyTypes = flattenGroupedSelections(
    lenderProduct?.propertyTypes,
  );

  if (
    rules.checkPropertyType &&
    applicant.propertyType &&
    lenderPropertyTypes.length > 0 &&
    !matchesPropertyTypeSelection(lenderPropertyTypes, applicant.propertyType)
  ) {
    reasons.push("Property type not supported");
  }

  const lenderBusinessTypes = resolveBusinessTypes(
    lenderProduct,
    lenderProfile,
  );

  if (
    rules.checkBusinessIndustry &&
    applicant.businessIndustry &&
    lenderBusinessTypes.length > 0 &&
    !matchesSelection(lenderBusinessTypes, applicant.businessIndustry)
  ) {
    reasons.push("Business industry not supported");
  }

  const minExp = Number(lenderProduct.minExperience);

  if (
    rules.checkMinExperience &&
    applicant.yearsInBusiness !== null &&
    Number.isFinite(minExp) &&
    minExp > 0 &&
    applicant.yearsInBusiness < minExp
  ) {
    reasons.push(`Minimum experience required (${minExp} years)`);
  }

  if (
    rules.checkMinTimeInBusiness &&
    applicant.yearsInBusiness !== null &&
    hasConfiguredNumber(lenderProduct.minTimeInBusinessMonths)
  ) {
    const applicantMonths = applicant.yearsInBusiness * 12;
    const requiredMonths = Number(lenderProduct.minTimeInBusinessMonths);

    if (applicantMonths < requiredMonths) {
      const startupEligible =
        rules.checkStartupAllowed &&
        lenderProduct.startupAllowed === true &&
        applicant.yearsInBusiness < 2;

      if (!startupEligible) {
        reasons.push(
          `Minimum time in business required (${requiredMonths} months)`,
        );
      }
    }
  }

  if (
    rules.checkStartupAllowed &&
    applicant.yearsInBusiness !== null &&
    applicant.yearsInBusiness < 2 &&
    lenderProduct.startupAllowed === false
  ) {
    reasons.push("Startups not allowed for this program");
  }

  if (
    rules.checkMinAnnualRevenue &&
    applicant.annualRevenue !== null &&
    hasConfiguredNumber(lenderProduct.minAnnualRevenue)
  ) {
    const minRevenue = Number(lenderProduct.minAnnualRevenue);
    if (applicant.annualRevenue < minRevenue) {
      reasons.push(`Annual revenue below minimum (${minRevenue})`);
    }
  }

  if (
    rules.checkOwnerOccupied &&
    lenderProduct.ownerOccupiedRequired === true &&
    applicant.ownerOccupied === false
  ) {
    reasons.push("Owner-occupied property required");
  }

  if (
    rules.checkRefinanceAllowed &&
    applicant.isRefinance === true &&
    lenderProduct.refinanceAllowed !== true
  ) {
    reasons.push("Refinance not allowed for this program");
  }

  if (
    rules.checkMinUnits &&
    applicant.numberOfUnits !== null &&
    hasConfiguredNumber(lenderProduct.minUnits) &&
    applicant.numberOfUnits < Number(lenderProduct.minUnits)
  ) {
    reasons.push(`Minimum units required (${lenderProduct.minUnits})`);
  }

  if (rules.checkPortfolioProperties && applicant.portfolioPropertyCount !== null) {
    if (
      hasConfiguredNumber(lenderProduct.minPropertiesInPortfolio) &&
      applicant.portfolioPropertyCount <
        Number(lenderProduct.minPropertiesInPortfolio)
    ) {
      reasons.push(
        `Portfolio below minimum properties (${lenderProduct.minPropertiesInPortfolio})`,
      );
    }

    if (
      hasConfiguredNumber(lenderProduct.maxPropertiesInPortfolio) &&
      applicant.portfolioPropertyCount >
        Number(lenderProduct.maxPropertiesInPortfolio)
    ) {
      reasons.push(
        `Portfolio exceeds maximum properties (${lenderProduct.maxPropertiesInPortfolio})`,
      );
    }
  }

  if (
    rules.checkFirstTimeBorrowers &&
    lenderProduct.firstTimeBorrowersAllowed === false &&
    isFirstTimeBorrower(applicant.similarProjectsCompleted)
  ) {
    reasons.push("First-time borrowers not allowed for this program");
  }

  return {
    reasons,
    minLoan,
    maxLoan,
    supportedStates,
    productCode,
    rules,
  };
}

async function syncProfileFundingToProducts(prisma, lenderOrgId, profile) {
  if (!profile || !lenderOrgId) {
    return;
  }

  const products = await prisma.lenderProduct.findMany({
    where: {
      lenderOrgId,
      isActive: true,
    },
    select: {
      id: true,
      minLoanAmount: true,
      maxLoanAmount: true,
      statesSupported: true,
    },
  });

  if (!products.length) {
    return;
  }

  const profileStates = parseStatesSupported(profile.statesSupported);
  const profileStatesCsv = profileStates.length
    ? profileStates.join(",")
    : null;

  await Promise.all(
    products.map((product) => {
      const data = {};

      if (!product.minLoanAmount && profile.minFunding) {
        data.minLoanAmount = profile.minFunding;
      }

      if (!product.maxLoanAmount && profile.maxFunding) {
        data.maxLoanAmount = profile.maxFunding;
      }

      if (!product.statesSupported && profileStatesCsv) {
        data.statesSupported = profileStatesCsv;
      }

      if (Object.keys(data).length === 0) {
        return Promise.resolve();
      }

      return prisma.lenderProduct.update({
        where: { id: product.id },
        data,
      });
    }),
  );
}

module.exports = {
  evaluateLenderProductEligibility,
  flattenGroupedSelections,
  formatLenderInterestRate,
  matchesPropertyTypeSelection,
  parseStatesSupported,
  resolveFundingRange,
  resolveSupportedStates,
  syncProfileFundingToProducts,
};
