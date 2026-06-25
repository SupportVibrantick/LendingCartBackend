const { z } = require("zod");

const lenderPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(
    /[^A-Za-z0-9]/,
    "Password must contain at least one special character",
  );

const lenderForgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address"),
});

const lenderResetPasswordSchema = z.object({
  token: z.string().trim().min(1, "Reset token is required"),
  password: lenderPasswordSchema,
});

module.exports = {
  lenderForgotPasswordSchema,
  lenderResetPasswordSchema,
  lenderPasswordSchema,
};
