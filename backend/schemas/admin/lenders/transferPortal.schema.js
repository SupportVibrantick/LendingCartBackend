const { z } = require("zod");

const usPhoneRegex =
  /^(\+1\s?)?(\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}$/;

const transferLenderPortalSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: z.string().trim().email("Invalid email").transform((value) =>
    value.toLowerCase(),
  ),
  phone: z
    .string()
    .trim()
    .min(1, "Phone is required")
    .regex(usPhoneRegex, "Invalid US phone number format")
    .transform((val) => {
      const digits = val.replace(/\D/g, "");
      if (digits.length === 10) return `+1${digits}`;
      if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
      throw new Error("Invalid US phone number");
    }),
});

module.exports = { transferLenderPortalSchema };
