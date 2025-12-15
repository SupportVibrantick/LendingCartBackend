// schemas/admin/lenderProducts/create.schema.js
const { z } = require("zod");

const createLenderProductSchema = z.object({
  lenderOrgId: z.string().uuid(),
  loanProductCode: z.enum([
    "SBA",
    "USDA",
    "BRIDGE",
    "DSCR",
    "CONSTRUCTION",
    "EQUIPMENT",
    "ASSET_BASED",
    "AR_AP",
    "PO_FINANCE",
  ]),
  minLoanAmount: z.number().nonnegative().optional(),
  maxLoanAmount: z.number().nonnegative().optional(),
  minTermMonths: z.number().int().nonnegative().optional(),
  maxTermMonths: z.number().int().nonnegative().optional(),
  regionsSupported: z.array(z.string()).optional(),
  industriesSupported: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

module.exports = { createLenderProductSchema };
