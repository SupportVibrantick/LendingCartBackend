async function lenderBrandingRoutes(fastify) {
  fastify.register(require("./getSettings"));
  fastify.register(require("./updateSettings"));
}

module.exports = lenderBrandingRoutes;
