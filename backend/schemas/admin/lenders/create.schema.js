// schemas/admin/lenders/create.schema.js
const { z } = require("zod");

const createLenderSchema = z.object({
  organizationName: z.string().min(1, "Organization name is required"),
  organizationEmail: z.string().email("Invalid organization email"),
  organizationPhone: z.string().min(1, "Organization phone is required"),

  adminFirstName: z.string().min(1, "Admin first name is required"),
  adminLastName: z.string().min(1, "Admin last name is required"),
  adminEmail: z.string().email("Invalid admin email"),
  adminPassword: z.string().min(8, "Admin password must be at least 8 characters"),

  // Optional — admin can choose to link this lender to any broker
  brokerOrgId: z.string().uuid().optional().nullable(),
});

module.exports = { createLenderSchema };
