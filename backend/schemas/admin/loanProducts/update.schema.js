const { z } = require("zod");

exports.updateLoanProductSchema = z.object({
  code: z.string().optional(), // enum string
  name: z.string().min(2).optional(),
  description: z.string().optional(),
});