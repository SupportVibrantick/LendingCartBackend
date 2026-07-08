const createRoutes = require("./create");
const createCustomDocumentTypeRoutes = require("./createCustomDocumentType");
const updateRoutes = require("./update");
const listRoutes = require("./list");
const deleteRoutes = require("./delete");
/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function lenderDocumentConfigRoutes(fastify) {
  fastify.register(createRoutes, { prefix: "/create" });
  fastify.register(createCustomDocumentTypeRoutes, {
    prefix: "/create-custom-document-type",
  });
  fastify.register(updateRoutes, { prefix: "/update" });
  fastify.register(listRoutes, { prefix: "/list" });
  fastify.register(deleteRoutes, {prefix:"/delete"});
}

module.exports = lenderDocumentConfigRoutes;
