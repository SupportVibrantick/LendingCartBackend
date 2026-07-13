const { z } = require("zod");

const deleteDocumentTypeSchema = z.object({
  id: z.string().uuid("Invalid document type id"),
});

module.exports = {
  deleteDocumentTypeSchema,
};
