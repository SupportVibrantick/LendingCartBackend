const { z } = require("zod");
const { LoanProductCode } = require("@prisma/client");
const {
  isMinMaxLoanAmountRangeValid,
  getMinMaxLoanAmountRangeError,
  isMinMaxTermRangeValid,
} = require("../../../utils/lender/validateLenderProductRanges");

// flexible object schema (category → subtypes)
const nestedTypeSchema = z.record(
  z.string(),
  z.array(z.string())
);

// ✅ allow number OR string, normalize to string
const experienceSchema = z
  .union([z.number().int(), z.string()])
  .optional()
  .transform((val) => {
    if (val === undefined || val === null) return undefined;
    return String(val);
  });

const baseProductSchema = z.object({
  loanProductCode: z.nativeEnum(LoanProductCode),

  businessTypes: nestedTypeSchema.optional(),
  propertyTypes: nestedTypeSchema.optional(),

  minLoanAmount: z.number().positive().optional(),
  maxLoanAmount: z.number().positive().optional(),

  minTermMonths: z.number().int().positive().optional(),
  maxTermMonths: z.number().int().positive().optional(),

maxLtvPercent: z.number().min(0).optional(),
minMezzLtvPercent: z.number().min(0).optional(),
maxMezzLtvPercent: z.number().min(0).optional(),
exitFeePercent: z.number().min(0).optional(),
preferredReturnPercent: z.number().min(0).optional(),

maxArvPercent: z.number().min(0).optional(),
maxLtcPercent: z.number().min(0).optional(),

  minCreditScore: z.number().int().optional(),

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
  preferredDscr: z.number().positive().optional(),
  maxTermRealEstateMonths: z.number().int().positive().optional(),
  intangibleAssetsAllowed: z.boolean().optional(),
  equipmentIncluded: z.boolean().optional(),
  realEstateIncluded: z.boolean().optional(),
  franchiseAcquisitionAllowed: z.boolean().optional(),
  collateralRequired: z.boolean().optional(),
    collateralAsDownPaymentAllowed: z.boolean().optional(),
    maxTermEquipmentMonths: z.number().int().positive().optional(),
    maximumDebtService: z.number().positive().optional(),
    businessAcquisitionAllowed: z.boolean().optional(),
    equipmentPurchaseAllowed: z.boolean().optional(),
    businessCreditRequired: z.boolean().optional(),
    usOperatingBusinessRequired: z.boolean().optional(),
    startupEligible: z.boolean().optional(),
    franchiseEligible: z.boolean().optional(),
    foreignOwnershipAllowed: z.boolean().optional(),
    bankruptcyAllowed: z.boolean().optional(),
    prepaymentPenalty: z.boolean().optional(),
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
  gcRequired: z.boolean().optional(),
  completionGuaranteeRequired: z.boolean().optional(),
  criteriaNotes: z.string().optional(),

  statesSupported: z.array(z.string()).optional(),

  equipmentTypes: z.array(z.string()).optional(),
  otherEquipmentExplanation: z.string().optional(),

  isActive: z.boolean().optional(),
});

const createLenderLoanProductSchema = z
  .object({
    products: z.array(baseProductSchema).optional(),

    loanProductCodes: z
      .array(z.nativeEnum(LoanProductCode))
      .optional(),

    businessTypes: nestedTypeSchema.optional(),
    propertyTypes: nestedTypeSchema.optional(),

    minLoanAmount: z.number().positive().optional(),
    maxLoanAmount: z.number().positive().optional(),

    minTermMonths: z.number().int().positive().optional(),
    maxTermMonths: z.number().int().positive().optional(),

maxArvPercent: z.number().min(0).optional(),
maxLtcPercent: z.number().min(0).optional(),
maxLtvPercent: z.number().min(0).optional(),

    minCreditScore: z.number().int().optional(),

    
    minExperience: experienceSchema,

    interestRateRange: z.string().optional(),

    statesSupported: z.array(z.string()).optional(),

    equipmentTypes: z.array(z.string()).optional(),
    otherEquipmentExplanation: z.string().optional(),

    isActive: z.boolean().optional(),
  })
  .refine(
    (data) => data.products || data.loanProductCodes,
    {
      message:
        "Either 'products' or 'loanProductCodes' must be provided",
    }
  )
  .superRefine((data, ctx) => {
    const items = data.products || [];

    items.forEach((item, index) => {
      if (!isMinMaxLoanAmountRangeValid(item)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: getMinMaxLoanAmountRangeError(item),
          path: ["products", index, "minLoanAmount"],
        });
      }

      if (!isMinMaxTermRangeValid(item)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "minTermMonths cannot be greater than maxTermMonths",
          path: ["products", index, "minTermMonths"],
        });
      }
    });
  });

module.exports = {
  createLenderLoanProductSchema,
};
