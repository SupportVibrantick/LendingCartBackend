/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function websiteBuilderWebsiteRoutes(fastify) {
  fastify.register(require("./getWebsite"));
  fastify.register(require("./publishWebsite"));
}

module.exports = websiteBuilderWebsiteRoutes;
