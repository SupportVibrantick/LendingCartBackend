const { z } = require("zod");

const updateDocumentTypeSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2),
  description: z.string().optional(),
  loanProductId: z.string().uuid().optional(),
  isRequired: z.boolean().optional(),
});

module.exports = {
  updateDocumentTypeSchema,
};
