const { z } = require("zod");

exports.updateLoanProductStatusSchema = z.object({
  isActive: z.boolean(),
});
