const login = require("./login");
const register = require("./register");
const me = require("./me");
const updateProfile = require("./updateProfile");
const forgotPassword = require("./forgotPassword");
const validateResetToken = require("./validateResetToken");
const resetPassword = require("./resetPassword");
const changePassword = require("./changePassword");

async function lenderAuthRoutes(fastify) {
  fastify.register(login, { prefix: "/login" });
  fastify.register(register, { prefix: "/register" });
  fastify.register(me, { prefix: "/me" });
  fastify.register(updateProfile, { prefix: "/update" });
  fastify.register(forgotPassword, { prefix: "/forgot-password" });
  fastify.register(validateResetToken, { prefix: "/reset-password/validate" });
  fastify.register(resetPassword, { prefix: "/reset-password" });
  fastify.register(changePassword, { prefix: "/change-password" });
}

module.exports = lenderAuthRoutes;
