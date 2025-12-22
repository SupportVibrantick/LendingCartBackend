const createRoutes = require("./create");
const updateRoutes = require("./update");
const listRoutes = require("./list");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function lenderDocumentConfigRoutes(fastify) {
  fastify.register(createRoutes, { prefix: "/create" });
  fastify.register(updateRoutes, { prefix: "/update" });
  fastify.register(listRoutes, { prefix: "/list" });
}

module.exports = lenderDocumentConfigRoutes;
