const { z } = require("zod");

const updateRuleSetSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  effectiveFrom: z.coerce.date().optional(),
  effectiveTo: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
});

module.exports = {
  updateRuleSetSchema,
};
