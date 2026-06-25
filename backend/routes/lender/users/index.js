module.exports = async function lenderUserRoutes(fastify) {
  fastify.register(require("./list"));
  fastify.register(require("./create"));
  fastify.register(require("./update"));
  fastify.register(require("./delete"));
};
