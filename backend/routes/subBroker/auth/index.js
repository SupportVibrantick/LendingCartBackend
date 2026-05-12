const loginRoute = require("./login");
const meRoute = require("./me");
const updateProfileRoute = require("./updateProfile");

async function subBrokerAuthRoutes(fastify, options) {
  fastify.register(loginRoute);

  fastify.register(meRoute);
  fastify.register(updateProfileRoute);
}

module.exports = subBrokerAuthRoutes;
