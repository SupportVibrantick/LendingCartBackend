module.exports = async function brokerApplicationSections(fastify) {
  fastify.register(require("./allSections"));
  fastify.register(require("./createSections"));
};
