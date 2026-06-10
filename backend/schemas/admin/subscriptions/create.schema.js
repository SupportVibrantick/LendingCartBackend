const { z } = require("zod");
const { usageLimitsSchema } = require("./usageLimits.schema");

const emptyToNull = (val) => (val === "" || val === undefined ? null : val);

const createSubscriptionPackageSchema = z.object({
  name: z.string().min(2, "Name is required"),
  code: z
    .string()
    .min(2)
    .regex(/^[A-Z0-9_]+$/, "Code must be uppercase letters, numbers, or underscores"),
  priceMonthly: z.coerce.number().positive("Price must be greater than zero"),
  priceYearly: z.preprocess(
    emptyToNull,
    z.union([z.null(), z.coerce.number().positive()]).optional(),
  ),
  description: z.string().optional(),
  features: z.string().optional(),
  usageLimits: usageLimitsSchema,
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
  isPopular: z.boolean().optional(),
});

module.exports = {
  createSubscriptionPackageSchema,
};
