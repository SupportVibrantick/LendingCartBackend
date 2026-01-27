async function whiteLabelRoutes(fastify) {
  fastify.register(require("./getSettings"));
  fastify.register(require("./updateSettings"));
//   fastify.register(require("./setSubdomain"));
//   fastify.register(require("./setCustomDomain"));
}

module.exports = whiteLabelRoutes;
