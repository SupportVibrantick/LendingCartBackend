const { z } = require("zod");

const optionalTrimmedString = z
  .string()
  .trim()
  .optional()
  .transform((val) => (val ? val : undefined));

const createBrokerSchema = z.object({
  organizationName: z
    .string()
    .trim()
    .min(2, "Organization name must be at least 2 characters")
    .max(100),

  organizationEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email("Invalid organization email"),

  organizationPhone: z
    .union([z.string(), z.number()])
    .transform((val) => String(val).replace(/\D/g, ""))
    .refine(
      (val) => /^[0-9]{10,15}$/.test(val),
      "Phone number must be 10–15 digits",
    ),

  adminFirstName: z
    .string()
    .trim()
    .min(2, "Admin first name must be at least 2 characters")
    .max(50)
    .regex(/^[A-Za-z\s'-]+$/, "First name may only contain letters"),

  adminLastName: z
    .string()
    .trim()
    .min(2, "Admin last name must be at least 2 characters")
    .max(50)
    .regex(/^[A-Za-z\s'-]+$/, "Last name may only contain letters"),

  adminEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email("Invalid admin email"),

  adminPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /[^A-Za-z0-9]/,
      "Password must contain at least one special character",
    ),

  adminPhone: z
    .union([z.string(), z.undefined()])
    .optional()
    .transform((val) => {
      const digits = String(val ?? "").replace(/\D/g, "");
      return digits || undefined;
    })
    .refine(
      (val) => val === undefined || /^[0-9]{10,15}$/.test(val),
      "Admin phone must be 10–15 digits",
    ),

  company: optionalTrimmedString,
  licenseNumber: optionalTrimmedString.refine(
    (val) => !val || /^[A-Za-z0-9-]{4,20}$/.test(val),
    "License must be 4–20 alphanumeric characters",
  ),
  address: optionalTrimmedString,
  city: optionalTrimmedString,
  state: optionalTrimmedString,
  zipCode: optionalTrimmedString.refine(
    (val) => !val || /^\d{5}(-\d{4})?$/.test(val),
    "Enter valid US ZIP (e.g. 12345 or 12345-6789)",
  ),
  website: optionalTrimmedString,
});

module.exports = { createBrokerSchema };
