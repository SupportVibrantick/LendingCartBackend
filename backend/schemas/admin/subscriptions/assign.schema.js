const { z } = require("zod");

const assignSubscriptionSchema = z.object({
  organizationId: z.string().uuid(),
  packageId: z.string().uuid(),
  billingCycle: z.enum(["MONTHLY", "YEARLY"]).optional().default("MONTHLY"),
  trialDays: z.coerce.number().int().min(0).optional().default(0),
  notes: z.string().optional(),
  generateInvoice: z.boolean().optional().default(true),
});

const changePlanSchema = z.object({
  organizationId: z.string().uuid(),
  packageId: z.string().uuid(),
  billingCycle: z.enum(["MONTHLY", "YEARLY"]).optional(),
  notes: z.string().optional(),
  generateInvoice: z.boolean().optional().default(false),
});

const cancelSubscriptionSchema = z.object({
  organizationId: z.string().uuid(),
  immediate: z.boolean().optional().default(false),
});

const refreshUsageSchema = z.object({
  organizationSubscriptionId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
});

const generateInvoiceSchema = z.object({
  organizationSubscriptionId: z.string().uuid(),
  notes: z.string().optional(),
});

const markInvoicePaidSchema = z.object({
  id: z.string().uuid(),
});

module.exports = {
  assignSubscriptionSchema,
  changePlanSchema,
  cancelSubscriptionSchema,
  refreshUsageSchema,
  generateInvoiceSchema,
  markInvoicePaidSchema,
};
