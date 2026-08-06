const { z } = require("zod");

const deleteDocumentTypeSchema = z.object({
  id: z.string().uuid("Invalid document type id"),
  /** When set, only unlink this document from the product (and delete type if unused). */
  loanProductId: z.string().uuid().optional(),
});

module.exports = {
  deleteDocumentTypeSchema,
};
