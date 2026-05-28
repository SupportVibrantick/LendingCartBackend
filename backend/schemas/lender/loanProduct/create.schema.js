const { z } = require("zod");
const { LoanProductCode } = require("@prisma/client");

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

maxArvPercent: z.number().min(0).optional(),
maxLtcPercent: z.number().min(0).optional(),

  minCreditScore: z.number().int().optional(),

  minExperience: experienceSchema,

  interestRateRange: z.string().optional(),

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
  .refine(
    (data) => {
      const items = data.products || [];
      return items.every(
        (item) =>
          !item.minLoanAmount ||
          !item.maxLoanAmount ||
          item.minLoanAmount <= item.maxLoanAmount
      );
    },
    {
      message:
        "minLoanAmount cannot be greater than maxLoanAmount",
    }
  )
  .refine(
    (data) => {
      const items = data.products || [];
      return items.every(
        (item) =>
          !item.minTermMonths ||
          !item.maxTermMonths ||
          item.minTermMonths <= item.maxTermMonths
      );
    },
    {
      message:
        "minTermMonths cannot be greater than maxTermMonths",
    }
  );

module.exports = {
  createLenderLoanProductSchema,
};
