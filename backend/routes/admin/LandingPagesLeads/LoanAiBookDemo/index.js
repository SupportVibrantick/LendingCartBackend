module.exports = async function (fastify) {
  fastify.register(require("./create"));
  fastify.register(require("./list"));
  fastify.register(require("./status"));
  fastify.register(require("./delete"));
  fastify.register(require("./syncGhl"));
};
