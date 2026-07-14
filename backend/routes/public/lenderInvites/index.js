async function publicLenderInviteRoutes(fastify) {
  fastify.register(require("./get"));
  fastify.register(require("./decline"));
}

module.exports = publicLenderInviteRoutes;
