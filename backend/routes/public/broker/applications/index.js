/**
 * Public Broker Applications Routes
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function publicBrokerApplications(fastify) {
  fastify.register(require("./getActiveApplication"));
  fastify.register(require("./getProductFields"));
  fastify.register(require("./resolvePublicApplicationLink"));
  fastify.register(require("./submitApplication"));
  fastify.register(require("./viewSubmission"));
  fastify.register(require("./listSubmissions"));
};
