const { z } = require("zod");

const createLenderLoanProductSchema = z.object({
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
  minLoanAmount: z.number().positive().optional(),
  maxLoanAmount: z.number().positive().optional(),
  minTermMonths: z.number().int().positive().optional(),
  maxTermMonths: z.number().int().positive().optional(),
  regionsSupported: z.array(z.string()).optional(),
  industriesSupported: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

module.exports = {
  createLenderLoanProductSchema,
};
