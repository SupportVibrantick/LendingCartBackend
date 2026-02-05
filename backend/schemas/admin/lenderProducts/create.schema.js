// schemas/admin/lenderProducts/create.schema.js
const { z } = require("zod");

const loanProductEnum = z.enum([
  "SBA",
  "USDA",
  "BRIDGE",
  "DSCR",
  "CONSTRUCTION",
  "EQUIPMENT",
  "ASSET_BASED",
  "AR_AP",
  "PO_FINANCE",
]);

const decimalField = z.union([z.string(), z.number()]).optional();

const createLenderProductSchema = z.object({
  lenderOrgId: z.string().uuid(),

  // multiple loan product codes
  loanProductCodes: z.array(loanProductEnum).min(1),

  businessTypes: z.array(z.string()).optional(),

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
