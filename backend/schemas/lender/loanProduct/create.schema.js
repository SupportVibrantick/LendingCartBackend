const { z } = require("zod");
const { LoanProductCode } = require("@prisma/client");

const baseProductSchema = z.object({
  loanProductCode: z.nativeEnum(LoanProductCode),

  businessTypes: z.array(z.string()).optional(),
  propertyTypes: z.array(z.string()).optional(),

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

  equipmentTypes: z.array(z.string()).optional(),
  otherEquipmentExplanation: z.string().optional(),

  isActive: z.boolean().optional(),
});

const createLenderLoanProductSchema = z
  .object({
    // NEW FORMAT (ADVANCED)
    products: z.array(baseProductSchema).optional(),

    // OLD FORMAT (BACKWARD COMPATIBLE)
    loanProductCodes: z
      .array(z.nativeEnum(LoanProductCode))
      .optional(),

    // shared fields (old format support)
    businessTypes: z.array(z.string()).optional(),
    propertyTypes: z.array(z.string()).optional(),

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