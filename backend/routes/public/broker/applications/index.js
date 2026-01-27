/**
 * Public Broker Applications Routes
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function publicBrokerApplications(fastify) {
  fastify.register(require("./getActiveApplication"));
  fastify.register(require("./getProductFields"));
  fastify.register(require("./submitApplication"));
};
