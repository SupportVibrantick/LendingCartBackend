async function brokerIntegrationsRoutes(fastify) {
  fastify.register(require("./ghl"), { prefix: "/ghl" });
}

module.exports = brokerIntegrationsRoutes;
