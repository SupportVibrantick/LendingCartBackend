/**
 * Template Products Routes
 */
async function templateProductsRoutes(fastify) {
  fastify.register(require("./createProduct"));

  // Sections under product
  fastify.register(require("../sections"), {
    prefix: "/:productId/sections",
  });

  // Fields under product
  fastify.register(require("../fields"), {
    prefix: "/:productId/fields",
  });
}

module.exports = templateProductsRoutes;
