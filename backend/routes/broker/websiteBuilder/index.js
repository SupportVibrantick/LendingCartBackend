/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function websiteBuilderRoutes(fastify) {
  fastify.register(require("./website"), { prefix: "/website" });
  fastify.register(require("./pages"), { prefix: "/website/pages" });
}

module.exports = websiteBuilderRoutes;
