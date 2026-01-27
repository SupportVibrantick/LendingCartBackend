/**
 * Template Products Routes
 */
async function templateProductsRoutes(fastify) {
  fastify.register(require("./createProduct"));

  // OPTIONAL (future)
  // fastify.register(require("./listProducts"));
  // fastify.register(require("./removeProduct"));

  // Fields under product
  fastify.register(require("../fields"), {
    prefix: "/:productId/fields",
  });
}

module.exports = templateProductsRoutes;
