const { z } = require("zod");

const createDocumentTypeSchema = z.object({
  name: z.string().min(2, "Name is required"),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  loanProductId: z.string().uuid("Loan product is required"),
  isRequired: z.boolean().optional().default(true),
});

module.exports = {
  createDocumentTypeSchema,
};
