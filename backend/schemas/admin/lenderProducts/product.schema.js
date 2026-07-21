const { z } = require("zod");
const { LoanProductCode } = require("@prisma/client");

const loanProductEnum = z.nativeEnum(LoanProductCode);
const decimalField = z.union([z.string(), z.number()]).optional();
const numberField = z.union([z.string(), z.number()]).optional();

const businessTypeSchema = z.object({
  name: z.string(),
  subTypes: z.array(z.string()).optional(),
});

const propertyTypeSchema = z.object({
  type: z.string(),
  subTypes: z.array(z.string()).optional(),
});

const lenderProductPayloadSchema = z
  .object({
    id: z.string().uuid().optional(),
    loanProductCode: loanProductEnum.optional(),

    businessTypes: z.array(businessTypeSchema).optional(),
    propertyTypes: z.array(propertyTypeSchema).optional(),

    equipmentTypes: z.array(z.string()).optional(),
    otherEquipmentExplanation: z.string().optional(),

    minLoanAmount: decimalField,
    maxLoanAmount: decimalField,

    minTermMonths: z.number().int().nonnegative().optional(),
    maxTermMonths: z.number().int().nonnegative().optional(),

    maxLtvPercent: decimalField,
    minMezzLtvPercent: decimalField,
    maxMezzLtvPercent: decimalField,
    exitFeePercent: decimalField,
    preferredReturnPercent: decimalField,
    maxArvPercent: decimalField,
    maxLtcPercent: decimalField,

    minCreditScore: z.number().int().nonnegative().optional(),
    minExperience: z.union([z.string(), z.number()]).optional(),

    interestRateRange: z.string().optional(),
    originationPointsPercent: numberField,
    extensionAvailable: z.boolean().optional(),
    personalGuaranteeRequired: z.boolean().optional(),
    firstTimeBorrowersAllowed: z.boolean().optional(),
    minDscr: numberField,
    minDebtYieldPercent: numberField,
    amortizationYears: z.number().int().optional(),
    minUnits: z.number().int().optional(),
    prepaymentStructure: z.string().optional(),
    minPropertiesInPortfolio: z.number().int().optional(),
    maxPropertiesInPortfolio: z.number().int().optional(),
    interestOnlyAvailable: z.boolean().optional(),
    shortTermRentalsOk: z.boolean().optional(),
    foreignNationalsAllowed: z.boolean().optional(),
    preferredLenderPlp: z.boolean().optional(),
    maxRateSpreadPercent: numberField,
    minRateSpreadPercent: numberField,
    sbaGuaranteePercent: numberField,
    minAnnualRevenue: decimalField,
    maxFinancingPercent: numberField,
    useOfFunds: z.string().optional(),
    collateralRequirements: z.string().optional(),
    rateStructure: z.string().optional(),
    refinanceAllowed: z.boolean().optional(),
    workingCapitalEligible: z.boolean().optional(),
    lifeInsuranceMayBeRequired: z.boolean().optional(),
    startupAllowed: z.boolean().optional(),
    environmentalReportRequired: z.boolean().optional(),
    appraisalRequired: z.boolean().optional(),
    avgTurnaroundDays: z.number().int().optional(),
    requiredInjectionPercent: numberField,
    goodwillFinancingAllowed: z.boolean().optional(),
    sellerFinancingAllowed: z.boolean().optional(),
    minLiquidityRequirement: z.string().optional(),
    ownerOccupancyRequirement: z.string().optional(),
    minTimeInBusinessMonths: z.number().int().optional(),
    lineOfCreditAvailable: z.boolean().optional(),
    usedEquipmentAllowed: z.boolean().optional(),
    ownerOccupiedRequired: z.boolean().optional(),
    maxTotalProjectAmount: numberField,
    maxSba504DebentureAmount: numberField,
    jobCreationRequired: z.boolean().optional(),
    maxUsdaGuaranteeAmount: numberField,
    usdaGuaranteePercent: numberField,
    ruralAreaRequired: z.boolean().optional(),
    advanceRatePercent: numberField,
    transactionFeePercent: numberField,
    minGrossMarginPercent: numberField,
    internationalPosAllowed: z.boolean().optional(),
    saleLeasebackAvailable: z.boolean().optional(),
    discountFeePercent: numberField,
    maxInvoiceAgeDays: z.number().int().optional(),
    nonRecourseAvailable: z.boolean().optional(),
    governmentInvoicesOk: z.boolean().optional(),
    earlyPaymentDiscountPercent: numberField,
    paymentTermsExtensionDays: z.number().int().optional(),
    dynamicDiscountingAvailable: z.boolean().optional(),
    reverseFactoringAvailable: z.boolean().optional(),
    gcRequired: z.boolean().optional(),
    completionGuaranteeRequired: z.boolean().optional(),
    criteriaNotes: z.string().optional(),

    statesSupported: z.array(z.string()).optional(),

    documents: z
      .array(
        z
          .object({
            id: z.string().uuid().optional(),
            documentTypeId: z.string().uuid().optional(),
          })
          .passthrough(),
      )
      .optional(),

    isActive: z.boolean().optional(),
  })
  .passthrough();

module.exports = {
  businessTypeSchema,
  propertyTypeSchema,
  lenderProductPayloadSchema,
  loanProductEnum,
  decimalField,
  numberField,
};
