const { z } = require("zod");

const toggleDocumentTypeStatusSchema = z.object({
  id: z.string().uuid(),
  isActive: z.boolean(),
});

module.exports = {
  toggleDocumentTypeStatusSchema,
};
