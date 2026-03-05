// schemas/admin/lenderProducts/update.schema.js

const { z } = require("zod");
const { LoanProductCode } = require("@prisma/client");

const decimalField = z.union([z.string(), z.number()]).optional();

const updateLenderProductSchema = z.object({

  // for deselect logic
  loanProductCodes: z.array(z.nativeEnum(LoanProductCode)).optional(),

  businessTypes: z.string().optional(),

  equipmentTypes: z.string().optional(),
  otherEquipmentExplanation: z.string().optional(),

  minLoanAmount: decimalField,
  maxLoanAmount: decimalField,

  minTermMonths: z.number().int().nonnegative().optional(),
  maxTermMonths: z.number().int().nonnegative().optional(),

  minLtvPercent: decimalField,
  maxLtvPercent: decimalField,

  minCreditScore: z.number().int().nonnegative().optional(),
  minExperience: z.string().optional(),

  interestRateRange: z.string().optional(),

  statesSupported: z.string().optional(),

  isActive: z.boolean().optional(),
});

module.exports = { updateLenderProductSchema };