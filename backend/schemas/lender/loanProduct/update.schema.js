const { z } = require("zod");

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
maxArvPercent: z.number().min(0).optional(),
    maxLtcPercent: z.number().min(0).optional(),

    minCreditScore: z.number().int().optional(),

    // ✅ FIXED
    minExperience: experienceSchema,

    interestRateRange: z.string().optional(),

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
    (data) =>
      !data.minLoanAmount ||
      !data.maxLoanAmount ||
      data.minLoanAmount <= data.maxLoanAmount,
    {
      message:
        "minLoanAmount cannot be greater than maxLoanAmount",
    }
  )

  // ✅ term validation
  .refine(
    (data) =>
      !data.minTermMonths ||
      !data.maxTermMonths ||
      data.minTermMonths <= data.maxTermMonths,
    {
      message:
        "minTermMonths cannot be greater than maxTermMonths",
    }
  );

module.exports = {
  updateLenderLoanProductSchema,
};