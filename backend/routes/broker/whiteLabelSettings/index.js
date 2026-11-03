async function whiteLabelRoutes(fastify) {
  fastify.register(require("./getSettings"));
  fastify.register(require("./updateSettings"));
  fastify.register(require("./verifyDomain"));
}

module.exports = whiteLabelRoutes;
