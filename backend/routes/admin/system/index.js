module.exports = async function systemRoutes(fastify) {
  fastify.register(require("./storageSettings"));
};
