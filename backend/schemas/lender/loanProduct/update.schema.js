const { z } = require("zod");
const { isMinMaxLoanAmountRangeValid, isMinMaxTermRangeValid } = require("../../../utils/lender/validateLenderProductRanges");

// subtype support (same as create)
const nestedTypeSchema = z.record(
  z.string(),
  z.array(z.string())
);

// allow number OR string → convert to string
const experienceSchema = z
  .union([z.number().int(), z.string()])
  .optional()
  .transform((val) => {
    if (val === undefined || val === null) return undefined;
    return String(val);
  });

const updateLenderLoanProductSchema = z
  .object({
    // 💰 FINANCIAL
    minLoanAmount: z.number().positive().optional(),
    maxLoanAmount: z.number().positive().optional(),

    minTermMonths: z.number().int().positive().optional(),
    maxTermMonths: z.number().int().positive().optional(),

    // ✅ LTV
maxLtvPercent: z.number().min(0).optional(),
    minMezzLtvPercent: z.number().min(0).optional(),
    maxMezzLtvPercent: z.number().min(0).optional(),
    exitFeePercent: z.number().min(0).optional(),
    preferredReturnPercent: z.number().min(0).optional(),
maxArvPercent: z.number().min(0).optional(),
    maxLtcPercent: z.number().min(0).optional(),

    minCreditScore: z.number().int().optional(),

    // ✅ FIXED
    minExperience: experienceSchema,

    interestRateRange: z.string().optional(),

    originationPointsPercent: z.number().min(0).optional(),
    extensionAvailable: z.boolean().optional(),
    personalGuaranteeRequired: z.boolean().optional(),
    firstTimeBorrowersAllowed: z.boolean().optional(),
    minDscr: z.number().positive().optional(),
    minDebtYieldPercent: z.number().min(0).optional(),
    amortizationYears: z.number().int().positive().optional(),
    minUnits: z.number().int().positive().optional(),
    prepaymentStructure: z.string().optional(),
    minPropertiesInPortfolio: z.number().int().positive().optional(),
    maxPropertiesInPortfolio: z.number().int().positive().optional(),
    interestOnlyAvailable: z.boolean().optional(),
    shortTermRentalsOk: z.boolean().optional(),
    foreignNationalsAllowed: z.boolean().optional(),
    gcRequired: z.boolean().optional(),
    completionGuaranteeRequired: z.boolean().optional(),
    preferredLenderPlp: z.boolean().optional(),
    maxRateSpreadPercent: z.number().min(0).optional(),
    minRateSpreadPercent: z.number().min(0).optional(),
    sbaGuaranteePercent: z.number().min(0).max(100).optional(),
    minAnnualRevenue: z.number().positive().optional(),
    maxFinancingPercent: z.number().min(0).max(100).optional(),
    useOfFunds: z.string().optional(),
    collateralRequirements: z.string().optional(),
    rateStructure: z.string().optional(),
    refinanceAllowed: z.boolean().optional(),
    workingCapitalEligible: z.boolean().optional(),
    lifeInsuranceMayBeRequired: z.boolean().optional(),
    startupAllowed: z.boolean().optional(),
    environmentalReportRequired: z.boolean().optional(),
    appraisalRequired: z.boolean().optional(),
    avgTurnaroundDays: z.number().int().positive().optional(),
    requiredInjectionPercent: z.number().min(0).max(100).optional(),
    goodwillFinancingAllowed: z.boolean().optional(),
    sellerFinancingAllowed: z.boolean().optional(),
    minLiquidityRequirement: z.string().optional(),
    ownerOccupancyRequirement: z.string().optional(),
    minTimeInBusinessMonths: z.number().int().min(0).optional(),
    lineOfCreditAvailable: z.boolean().optional(),
    usedEquipmentAllowed: z.boolean().optional(),
    ownerOccupiedRequired: z.boolean().optional(),
    maxTotalProjectAmount: z.number().positive().optional(),
    maxSba504DebentureAmount: z.number().positive().optional(),
    jobCreationRequired: z.boolean().optional(),
    maxUsdaGuaranteeAmount: z.number().positive().optional(),
    usdaGuaranteePercent: z.number().min(0).max(100).optional(),
    ruralAreaRequired: z.boolean().optional(),
    advanceRatePercent: z.number().min(0).max(100).optional(),
    transactionFeePercent: z.number().min(0).max(100).optional(),
    minGrossMarginPercent: z.number().min(0).max(100).optional(),
    internationalPosAllowed: z.boolean().optional(),
    saleLeasebackAvailable: z.boolean().optional(),
    discountFeePercent: z.number().min(0).max(100).optional(),
    maxInvoiceAgeDays: z.number().int().positive().optional(),
    nonRecourseAvailable: z.boolean().optional(),
    governmentInvoicesOk: z.boolean().optional(),
    earlyPaymentDiscountPercent: z.number().min(0).max(100).optional(),
    paymentTermsExtensionDays: z.number().int().positive().optional(),
    dynamicDiscountingAvailable: z.boolean().optional(),
    reverseFactoringAvailable: z.boolean().optional(),
    criteriaNotes: z.string().optional(),

    // ✅ JSON (subtype support)
    businessTypes: nestedTypeSchema.optional(),
    propertyTypes: nestedTypeSchema.optional(),

    // ✅ ARRAY → converted to CSV in API
    statesSupported: z.array(z.string()).optional(),

    // ✅ EQUIPMENT
    equipmentTypes: z.array(z.string()).optional(),
    otherEquipmentExplanation: z.string().optional(),

    // ✅ STATUS
    isActive: z.boolean().optional(),
  })

  // ✅ at least one field
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  })

  // ✅ loan validation
  .refine(
    (data) => isMinMaxLoanAmountRangeValid(data),
    {
      message: "minLoanAmount cannot be greater than maxLoanAmount",
    },
  )

  // ✅ term validation
  .refine(
    (data) => isMinMaxTermRangeValid(data),
    {
      message: "minTermMonths cannot be greater than maxTermMonths",
    },
  );

module.exports = {
  updateLenderLoanProductSchema,
};