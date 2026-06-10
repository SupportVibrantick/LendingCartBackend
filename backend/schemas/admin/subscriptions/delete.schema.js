const { z } = require("zod");

const deleteSubscriptionPackageSchema = z.object({
  id: z.string().uuid(),
});

module.exports = {
  deleteSubscriptionPackageSchema,
};
