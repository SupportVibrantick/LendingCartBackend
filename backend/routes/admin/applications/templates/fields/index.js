/**
 * Template Product Fields Routes
 */
async function templateProductFieldsRoutes(fastify) {
  fastify.register(require("./createField"));
}

module.exports = templateProductFieldsRoutes;
