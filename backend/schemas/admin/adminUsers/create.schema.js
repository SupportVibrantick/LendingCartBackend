// schemas/admin/adminUsers/create.schema.js
const { z } = require("zod");

const createAdminUserSchema = z.object({
  firstName: z
    .string()
    .min(2, "First name must contain at least 2 characters"),

  lastName: z
    .string()
    .min(2, "Last name must contain at least 2 characters")
    .optional()
    .nullable(),

  email: z
    .string()
    .email("Invalid email format"),

  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .regex(/[A-Z]/, "Must contain one uppercase letter")
    .regex(/[a-z]/, "Must contain one lowercase letter")
    .regex(/[0-9]/, "Must contain one number")
    .regex(/[^A-Za-z0-9]/, "Must contain one special character"),
});

module.exports = { createAdminUserSchema };
