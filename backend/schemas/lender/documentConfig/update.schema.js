const { z } = require("zod");

const updateLenderDocumentConfigSchema = z.object({
  isRequired: z.boolean().optional(),
  minFiles: z.number().int().positive().optional(),
  maxFiles: z.number().int().positive().optional(),
  notes: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

module.exports = {
  updateLenderDocumentConfigSchema,
};
