module.exports = async function documentTypesCommonRoutes(fastify) {
  fastify.register(require("./listActive"));
  fastify.register(require("./wizardOptions"));
  fastify.register(require("./createCustom"));
};
