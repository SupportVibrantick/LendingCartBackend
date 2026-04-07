const { z } = require("zod");
const { LoanProductCode } = require("@prisma/client");

// 🔥 flexible object schema (category → subtypes)
const nestedTypeSchema = z.record(
  z.string(),
  z.array(z.string())
);

const baseProductSchema = z.object({
  loanProductCode: z.nativeEnum(LoanProductCode),

  // ✅ NOW SUPPORTS SUBTYPES
  businessTypes: nestedTypeSchema.optional(),
  propertyTypes: nestedTypeSchema.optional(),

  minLoanAmount: z.number().positive().optional(),
  maxLoanAmount: z.number().positive().optional(),

  minTermMonths: z.number().int().positive().optional(),
  maxTermMonths: z.number().int().positive().optional(),

  minLtvPercent: z.number().positive().optional(),
  maxLtvPercent: z.number().positive().optional(),

  minCreditScore: z.number().int().optional(),
  minExperience: z.number().int().optional(),

  interestRateRange: z.string().optional(),

  statesSupported: z.array(z.string()).optional(),

  // ✅ equipment also supports subtype
  equipmentTypes: nestedTypeSchema.optional(),
  otherEquipmentExplanation: z.string().optional(),

  isActive: z.boolean().optional(),
});

const createLenderLoanProductSchema = z
  .object({
    products: z.array(baseProductSchema).optional(),

    loanProductCodes: z
      .array(z.nativeEnum(LoanProductCode))
      .optional(),

    // shared fields (old format)
    businessTypes: nestedTypeSchema.optional(),
    propertyTypes: nestedTypeSchema.optional(),

    minLoanAmount: z.number().positive().optional(),
    maxLoanAmount: z.number().positive().optional(),

    minTermMonths: z.number().int().positive().optional(),
    maxTermMonths: z.number().int().positive().optional(),

    minLtvPercent: z.number().positive().optional(),
    maxLtvPercent: z.number().positive().optional(),

    minCreditScore: z.number().int().optional(),
    minExperience: z.number().int().optional(),

    interestRateRange: z.string().optional(),

    statesSupported: z.array(z.string()).optional(),

    equipmentTypes: nestedTypeSchema.optional(),
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