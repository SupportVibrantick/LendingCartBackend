const { z } = require("zod");

const createLenderDocumentConfigSchema = z.object({
  lenderProductId: z.string().uuid(),
  documentTypeId: z.string().uuid().optional(),
  customDocumentName: z.string().trim().min(2).max(120).optional(),

  isRequired: z.boolean().optional(),

  minFiles: z.number().int().positive().optional(),
  maxFiles: z.number().int().positive().optional(),

  notes: z.string().optional(),
  sortOrder: z.number().int().optional(),
}).superRefine((data, ctx) => {
  if (!data.documentTypeId && !data.customDocumentName) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Either documentTypeId or customDocumentName is required",
      path: ["documentTypeId"],
    });
  }
});

module.exports = {
  createLenderDocumentConfigSchema,
};
