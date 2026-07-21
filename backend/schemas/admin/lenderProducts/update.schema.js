const { z } = require("zod");
const { lenderProductPayloadSchema } = require("./product.schema");

const updateLenderProductSchema = z.object({
  lenderOrgId: z.string().uuid(),
  products: z.array(lenderProductPayloadSchema).min(1),
});

module.exports = { updateLenderProductSchema };
