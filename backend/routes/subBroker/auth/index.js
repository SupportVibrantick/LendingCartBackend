const loginRoute = require("./login");
const meRoute = require("./me");
const updateProfileRoute = require("./updateProfile");
const brandingRoute = require("./branding");

async function subBrokerAuthRoutes(fastify, options) {
  fastify.register(loginRoute);

  fastify.register(meRoute);
  fastify.register(updateProfileRoute);
  fastify.register(brandingRoute);
}

module.exports = subBrokerAuthRoutes;
