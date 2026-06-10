module.exports = async function (fastify) {
  fastify.register(require("./list"));
  fastify.register(require("./status"));
  fastify.register(require("./delete"));
};
