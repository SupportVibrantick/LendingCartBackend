// schemas/admin/lenderProducts/create.schema.js
const { z } = require("zod");
const { LoanProductCode } = require("@prisma/client");

const loanProductEnum = z.nativeEnum(LoanProductCode);

const decimalField = z.union([z.string(), z.number()]).optional();

const createLenderProductSchema = z.object({
  lenderOrgId: z.string().uuid(),

  // automatically synced with Prisma enum
  loanProductCodes: z.array(loanProductEnum).min(1),

  businessTypes: z.array(z.string()).optional(),

  equipmentTypes: z.array(z.string()).optional(),
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

  statesSupported: z.array(z.string()).optional(),

  isActive: z.boolean().optional(),
});

module.exports = { createLenderProductSchema };