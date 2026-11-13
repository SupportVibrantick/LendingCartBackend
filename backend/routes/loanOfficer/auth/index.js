const loginRoute = require("./login");
const meRoute = require("./me");
const updateProfileRoute = require("./updateProfile");
const changePasswordRoute = require("./changePassword");
const bankingRoute = require("./banking");
const { registerAuthLogoutRoute } = require("../../common/authLogoutRoute");

async function loanOfficerAuthRoutes(fastify) {
  await fastify.register(loginRoute);
  await fastify.register(meRoute);
  await fastify.register(updateProfileRoute);
  await fastify.register(bankingRoute);
  await fastify.register(changePasswordRoute, { prefix: "/change-password" });
  registerAuthLogoutRoute(fastify, {
    dashboard: "BROKER",
    preHandler: [fastify.authenticate],
  });
}

module.exports = loanOfficerAuthRoutes;
