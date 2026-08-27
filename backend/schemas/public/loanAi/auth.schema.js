const { z } = require("zod");

const loanAiPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

const loanAiRegisterSchema = z.object({
  firstName: z.string().trim().min(2).max(50),
  lastName: z.string().trim().min(2).max(50),
  email: z.string().trim().toLowerCase().email(),
  password: loanAiPasswordSchema,
});

const loanAiLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

const loanAiPurchaseSchema = z.object({
  packageId: z.string().uuid(),
  billingCycle: z.enum(["MONTHLY", "YEARLY"]).default("MONTHLY"),
  organizationName: z.string().trim().min(3).max(100),
  organizationEmail: z.string().trim().toLowerCase().email(),
  organizationPhone: z
    .union([z.string(), z.number()])
    .transform((val) => String(val))
    .refine((val) => /^[0-9]{10,15}$/.test(val), "Phone must be 10–15 digits"),
  firstName: z.string().trim().min(2).max(50),
  lastName: z.string().trim().min(2).max(50),
  addOnCodes: z.array(z.string().trim().min(1)).optional().default([]),
});

const organizationPhoneSchema = z
  .union([z.string(), z.number()])
  .transform((val) => String(val).replace(/\D/g, ""))
  .refine((val) => /^[0-9]{10,15}$/.test(val), "Phone must be 10–15 digits");

/** GHL checkout init — uses project naming `billingCycle` (alias: billingPeriod). */
const loanAiCheckoutSchema = z
  .object({
    packageId: z.string().uuid("packageId must be a valid UUID"),
    billingCycle: z.enum(["MONTHLY", "YEARLY"]).optional(),
    billingPeriod: z.enum(["MONTHLY", "YEARLY"]).optional(),
    successUrl: z.string().url().optional(),
    cancelUrl: z.string().url().optional(),
    /** @deprecated Prefer organizationPhone — kept for older clients. */
    phone: z
      .union([z.string(), z.number()])
      .optional()
      .transform((val) => (val == null || val === "" ? undefined : String(val))),
    organizationName: z.string().trim().min(3).max(100),
    organizationEmail: z.string().trim().toLowerCase().email(),
    organizationPhone: organizationPhoneSchema,
    firstName: z.string().trim().min(2).max(50),
    lastName: z.string().trim().min(2).max(50),
    addOnCodes: z.array(z.string().trim().min(1)).optional().default([]),
  })
  .strict()
  .transform((data) => {
    const billingCycle = data.billingCycle || data.billingPeriod || "MONTHLY";
    return {
      packageId: data.packageId,
      billingCycle,
      successUrl: data.successUrl,
      cancelUrl: data.cancelUrl,
      phone: data.organizationPhone || data.phone,
      organizationName: data.organizationName,
      organizationEmail: data.organizationEmail,
      organizationPhone: data.organizationPhone,
      firstName: data.firstName,
      lastName: data.lastName,
      addOnCodes: data.addOnCodes || [],
    };
  })
  .superRefine((data, ctx) => {
    if (!["MONTHLY", "YEARLY"].includes(data.billingCycle)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "billingCycle must be MONTHLY or YEARLY",
        path: ["billingCycle"],
      });
    }
  });

module.exports = {
  loanAiRegisterSchema,
  loanAiLoginSchema,
  loanAiPurchaseSchema,
  loanAiCheckoutSchema,
};
