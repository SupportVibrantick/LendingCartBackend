const { z } = require("zod");

const createDocumentTypeSchema = z.object({
  name: z.string().min(2, "Name is required"),
  code: z
    .string()
    .min(2)
    .regex(/^[A-Z_]+$/, "Code must be uppercase with underscores"),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

module.exports = {
  createDocumentTypeSchema,
};
