const loginRoute = require("./login");
const meRoute = require("./me");
const updateProfileRoute = require("./updateProfile");
const brandingRoute = require("./branding");
const changePasswordRoute = require("./changePassword");
const bankingRoute = require("./banking");
const { registerAuthLogoutRoute } = require("../../common/authLogoutRoute");

async function subBrokerAuthRoutes(fastify, options) {
  fastify.register(loginRoute);

  fastify.register(meRoute);
  fastify.register(updateProfileRoute);
  fastify.register(bankingRoute);
  fastify.register(brandingRoute);
  fastify.register(changePasswordRoute, { prefix: "/change-password" });
  registerAuthLogoutRoute(fastify, {
    dashboard: "BROKER",
    preHandler: [fastify.authenticate],
  });
}

module.exports = subBrokerAuthRoutes;
