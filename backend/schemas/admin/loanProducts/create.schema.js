const { z } = require("zod");

exports.createLoanProductSchema = z.object({
  code: z.string(), // Should match LoanProductCode enum
  name: z.string().min(2),
  description: z.string().optional(),
});
