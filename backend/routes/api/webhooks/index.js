async function webhookRoutes(fastify) {
  fastify.register(require("./ghl"), { prefix: "/ghl" });
}

module.exports = webhookRoutes;
