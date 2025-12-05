const { z } = require("zod");

exports.updateLoanProductSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
});
