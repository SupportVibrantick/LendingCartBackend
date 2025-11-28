// schemas/admin/login/add.schema.js
const { z } = require("zod");

const createOrganizationSchema = z.object({
  name: z.string().min(2, "Organization name is required"),
  type: z.enum(["PLATFORM","BROKER","LENDER","ESCROW_TITLE"]),
  status: z.enum(["ACTIVE","INACTIVE"]).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional()
});

module.exports = {
  createOrganizationSchema
};
