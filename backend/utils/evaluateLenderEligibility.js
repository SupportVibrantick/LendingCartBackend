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

function evaluateLenderProductEligibility(lenderProduct, applicant, lenderProfile) {
  const reasons = [];

  const { minLoan, maxLoan } = resolveFundingRange(
    lenderProduct,
    lenderProfile,
  );

  if (applicant.loanAmount !== null) {
    if (minLoan && applicant.loanAmount < minLoan) {
      reasons.push(`Loan below minimum (${minLoan})`);
    }

    if (maxLoan && applicant.loanAmount > maxLoan) {
      reasons.push(`Loan exceeds maximum (${maxLoan})`);
    }
  }

  if (applicant.termMonths !== null) {
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

  if (applicant.creditScore !== null && lenderProduct.minCreditScore) {
    if (applicant.creditScore < lenderProduct.minCreditScore) {
      reasons.push(
        `Credit score below minimum (${lenderProduct.minCreditScore})`,
      );
    }
  }

  if (
    applicant.ltv !== null &&
    lenderProduct.maxLtvPercent &&
    applicant.ltv > Number(lenderProduct.maxLtvPercent)
  ) {
    reasons.push(`LTV exceeds maximum (${lenderProduct.maxLtvPercent}%)`);
  }

  if (
    applicant.ltc !== null &&
    lenderProduct.maxLtcPercent &&
    applicant.ltc > Number(lenderProduct.maxLtcPercent)
  ) {
    reasons.push(`LTC exceeds maximum (${lenderProduct.maxLtcPercent}%)`);
  }

  if (
    applicant.arv !== null &&
    lenderProduct.maxArvPercent &&
    applicant.arv > Number(lenderProduct.maxArvPercent)
  ) {
    reasons.push(`ARV exceeds maximum (${lenderProduct.maxArvPercent}%)`);
  }

  if (
    applicant.dscr !== null &&
    lenderProduct.minDscr !== null &&
    lenderProduct.minDscr !== undefined
  ) {
    const minDscr = Number(lenderProduct.minDscr);
    if (Number.isFinite(minDscr) && applicant.dscr < minDscr) {
      reasons.push(`DSCR below minimum (${minDscr})`);
    }
  }

  const supportedStates = resolveSupportedStates(
    lenderProduct,
    lenderProfile,
  );

  if (applicant.propertyState && supportedStates.length > 0) {
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
    applicant.propertyType &&
    lenderPropertyTypes.length > 0 &&
    !matchesSelection(lenderPropertyTypes, applicant.propertyType)
  ) {
    reasons.push("Property type not supported");
  }

  const lenderBusinessTypes = resolveBusinessTypes(
    lenderProduct,
    lenderProfile,
  );

  if (
    applicant.businessIndustry &&
    lenderBusinessTypes.length > 0 &&
    !matchesSelection(lenderBusinessTypes, applicant.businessIndustry)
  ) {
    reasons.push("Business industry not supported");
  }

  const minExp = Number(lenderProduct.minExperience);

  if (
    applicant.yearsInBusiness !== null &&
    Number.isFinite(minExp) &&
    minExp > 0 &&
    applicant.yearsInBusiness < minExp
  ) {
    reasons.push(`Minimum experience required (${minExp} years)`);
  }

  return {
    reasons,
    minLoan,
    maxLoan,
    supportedStates,
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
  parseStatesSupported,
  resolveFundingRange,
  resolveSupportedStates,
  syncProfileFundingToProducts,
};
