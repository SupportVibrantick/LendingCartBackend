const { z } = require("zod");
const { brokerPasswordSchema } = require("./resetPassword.schema");

const brokerChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: brokerPasswordSchema,
});

module.exports = { brokerChangePasswordSchema };
