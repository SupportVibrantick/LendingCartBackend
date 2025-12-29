const { z } = require("zod");

exports.createRuleSetSchema = z.object({
  lenderLoanProductId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
});
