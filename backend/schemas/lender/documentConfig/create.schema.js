const { z } = require("zod");

const createLenderDocumentConfigSchema = z.object({
  lenderProductId: z.string().uuid(),
  documentTypeId: z.string().uuid(),

  isRequired: z.boolean().optional(),

  minFiles: z.number().int().positive().optional(),
  maxFiles: z.number().int().positive().optional(),

  notes: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

module.exports = {
  createLenderDocumentConfigSchema,
};
