const { z } = require("zod");

const loginSchema = z.object({
  email: z
    .string({
      required_error: "Email is required",
    })
    .email("Please enter a valid email"),

  password: z
    .string({
      required_error: "Password is required",
    })
    .min(
      6,
      "Password must be at least 6 characters"
    ),
});

module.exports = {
  loginSchema,
};