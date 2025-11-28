// schemas/document/upload.schema.js
const { z } = require("zod");

const uploadDocumentSchema = z.object({
  loanApplicationId: z.string().uuid(),
  documentRequirementId: z.string().uuid().optional(),
  uploadedByUserId: z.string().uuid().optional(),
  uploadedByClientUserId: z.string().uuid().optional(),
  fileName: z.string(),
  fileUrl: z.string().url(),
  fileMimeType: z.string().optional()
});

module.exports = { uploadDocumentSchema };
