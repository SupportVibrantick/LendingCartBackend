const { z } = require("zod");
const { lenderPasswordSchema } = require("./resetPassword.schema");

const lenderChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: lenderPasswordSchema,
});

module.exports = { lenderChangePasswordSchema };
