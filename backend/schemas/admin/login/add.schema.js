const { z } = require("zod");

const addSchema = () => {
  return z
    .object({
      email: z
        .string({
          required_error: "Email is required",
        })
        .email("Please enter a valid email address"),

      password: z
        .string({
          required_error: "Password is required",
        })
        .min(6, "Password must be at least 6 characters long"),
    })
    .strict();
};

module.exports = { addSchema };
