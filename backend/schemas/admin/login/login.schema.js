// backend/schemas/admin/login/login.schema.js
const { z } = require("zod");

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

function loginSchemaValidator(req, res, next) {
  try {
    loginSchema.parse(req.body);
    next();
  } catch (err) {
    return res.status(400).json({ ok: false, errors: err.errors });
  }
}

module.exports = {
  loginSchema,
  loginSchemaValidator,
};
