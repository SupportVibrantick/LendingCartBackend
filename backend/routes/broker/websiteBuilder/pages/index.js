/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function websiteBuilderPagesRoutes(fastify) {
  fastify.register(require("./getPages"));
  fastify.register(require("./getPageByType"));
  fastify.register(require("./savePage"));
  fastify.register(require("./togglePage"));
}

module.exports = websiteBuilderPagesRoutes;
