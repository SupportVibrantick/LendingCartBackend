// broker/lenderDiscovery/index.js
module.exports = async function lenderDiscoveryRoutes(fastify) {
  fastify.register(require("./findEligible"), { prefix: "" });
  fastify.register(require("./sendToLenders"), { prefix: "" });
};