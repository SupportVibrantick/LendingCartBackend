const login = require("./login");
const register = require("./register");
const me = require("./me");
const updateProfileRoutes = require("./updateProfile");
const forgotPassword = require("./forgotPassword");
const validateResetToken = require("./validateResetToken");
const resetPassword = require("./resetPassword");
const changePassword = require("./changePassword");
const verifyEmail = require("./verifyEmail");
const stopImpersonation = require("./stopImpersonation");
const { registerAuthLogoutRoute } = require("../../common/authLogoutRoute");

async function lenderAuthRoutes(fastify) {
  fastify.register(login, { prefix: "/login" });
  fastify.register(register, { prefix: "/register" });
  fastify.register(verifyEmail, { prefix: "/verify-email" });
  fastify.register(forgotPassword, { prefix: "/forgot-password" });
  fastify.register(validateResetToken, { prefix: "/reset-password/validate" });
  fastify.register(resetPassword, { prefix: "/reset-password" });
  fastify.register(changePassword, { prefix: "/change-password" });
  fastify.register(stopImpersonation);
  fastify.register(me);
  fastify.register(updateProfileRoutes);
  registerAuthLogoutRoute(fastify, {
    dashboard: "LENDER",
    preHandler: [fastify.authenticate],
  });
}

module.exports = lenderAuthRoutes;
