// schemas/admin/lenders/create.schema.js
const { z } = require("zod");

// 🇺🇸 US Phone Regex
// Accepts:
// 1234567890
// 123-456-7890
// (123) 456-7890
// 123 456 7890
// +11234567890
const usPhoneRegex =
  /^(\+1\s?)?(\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}$/;

const createLenderSchema = z.object({
  organizationName: z
    .string()
    .min(1, "Organization name is required"),

  organizationEmail: z
    .string()
    .email("Invalid organization email"),

  organizationPhone: z
    .string()
    .min(1, "Organization phone is required")
    .regex(usPhoneRegex, "Invalid US phone number format")
    .transform((val) => {
      // Remove all non-digits
      const digits = val.replace(/\D/g, "");

      // Normalize to +1XXXXXXXXXX
      if (digits.length === 10) {
        return `+1${digits}`;
      }

      if (digits.length === 11 && digits.startsWith("1")) {
        return `+${digits}`;
      }

      // Should not reach here due to regex, but extra safety
      throw new Error("Invalid US phone number");
    }),

  adminFirstName: z
    .string()
    .min(1, "Admin first name is required"),

  adminLastName: z
    .string()
    .min(1, "Admin last name is required"),

  adminEmail: z
    .string()
    .email("Invalid admin email"),

  adminPassword: z
    .string()
    .min(8, "Admin password must be at least 8 characters"),

  // Optional — admin can choose to link this lender to any broker
  brokerOrgId: z
    .string()
    .uuid("Invalid broker ID")
    .optional()
    .nullable(),
});

module.exports = { createLenderSchema };