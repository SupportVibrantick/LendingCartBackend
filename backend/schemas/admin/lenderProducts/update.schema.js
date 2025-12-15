// schemas/admin/lenderProducts/update.schema.js
const { z } = require("zod");

const updateLenderProductSchema = z.object({
  minLoanAmount: z.number().nonnegative().optional(),
  maxLoanAmount: z.number().nonnegative().optional(),
  minTermMonths: z.number().int().nonnegative().optional(),
  maxTermMonths: z.number().int().nonnegative().optional(),
  regionsSupported: z.array(z.string()).optional(),
  industriesSupported: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

module.exports = { updateLenderProductSchema };
