const { z } = require("zod");

const brokerRegisterSchema = z.object({
  // ---------------------------
  // Organization details
  // ---------------------------
  organizationName: z
    .string()
    .trim()
    .min(3, "Organization name must be at least 3 characters")
    .max(100),

  organizationEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email("Invalid organization email"),

  // ✅ FIX: accept number OR string
  organizationPhone: z
    .union([
      z.string(),
      z.number(),
    ])
    .transform((val) => String(val))
    .refine(
      (val) => /^[0-9]{10,15}$/.test(val),
      "Phone number must be 10–15 digits"
    ),

  // ---------------------------
  // Admin user details
  // ---------------------------
  firstName: z
    .string()
    .trim()
    .min(2, "First name must be at least 2 characters")
    .max(50),

  lastName: z
    .string()
    .trim()
    .min(2, "Last name must be at least 2 characters")
    .max(50),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Invalid admin email"),

  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /[^A-Za-z0-9]/,
      "Password must contain at least one special character"
    ),
});

module.exports = {
  brokerRegisterSchema,
};
