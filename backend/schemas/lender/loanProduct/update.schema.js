const { z } = require("zod");

const updateLenderLoanProductSchema = z
  .object({
    minLoanAmount: z.number().positive().optional(),
    maxLoanAmount: z.number().positive().optional(),

    minTermMonths: z.number().int().positive().optional(),
    maxTermMonths: z.number().int().positive().optional(),

    regionsSupported: z.array(z.string()).optional(),
    industriesSupported: z.array(z.string()).optional(),

    isActive: z.boolean().optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      message: "At least one field must be provided for update",
    }
  );

module.exports = {
  updateLenderLoanProductSchema,
};
