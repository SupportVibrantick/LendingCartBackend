const loginRoute = require("./login");
const meRoute = require("./me");

async function subBrokerAuthRoutes(fastify, options) {
  fastify.register(loginRoute);

  fastify.register(meRoute);
}

module.exports = subBrokerAuthRoutes;
