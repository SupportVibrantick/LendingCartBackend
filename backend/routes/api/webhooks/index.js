async function webhookRoutes(fastify) {
  fastify.register(require("./ghl"), { prefix: "/ghl" });
  fastify.register(require("./stripe"), { prefix: "/stripe" });
}

module.exports = webhookRoutes;
