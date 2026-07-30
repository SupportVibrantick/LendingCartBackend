async function communityLenderRoutes(fastify) {
  fastify.register(require("./checkDuplicate"));
  fastify.register(require("./submit"));
  fastify.register(require("./submissions"));
}

module.exports = communityLenderRoutes;
