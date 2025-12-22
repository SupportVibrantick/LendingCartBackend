const { z } = require("zod");

const createRuleSetSchema = z.object({
  lenderProductId: z.string().uuid(),
  name: z.string().min(3),
  description: z.string().optional(),
});

module.exports = {
  createRuleSetSchema,
};
