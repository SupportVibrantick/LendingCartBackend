/**
 * Application Templates Routes (Admin)
 */
async function applicationTemplateRoutes(fastify) {
  // Templates
  fastify.register(require("./createTemplate"));
  fastify.register(require("./listTemplate"));
  fastify.register(require("./activateTemplate"));

  // ✅ Mount PRODUCTS FOLDER (not a file)
  fastify.register(require("./products"), {
    prefix: "/:templateId/products",
  });
}

module.exports = applicationTemplateRoutes;
