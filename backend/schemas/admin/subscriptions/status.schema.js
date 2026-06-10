const { z } = require("zod");

const toggleSubscriptionPackageStatusSchema = z.object({
  id: z.string().uuid(),
  isActive: z.boolean(),
});

module.exports = {
  toggleSubscriptionPackageStatusSchema,
};
