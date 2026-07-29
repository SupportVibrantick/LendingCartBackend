const loginRoute = require("./login");
const meRoute = require("./me");
const updateProfileRoute = require("./updateProfile");

async function loanOfficerAuthRoutes(fastify) {
  await fastify.register(loginRoute);
  await fastify.register(meRoute);
  await fastify.register(updateProfileRoute);
}

module.exports = loanOfficerAuthRoutes;
