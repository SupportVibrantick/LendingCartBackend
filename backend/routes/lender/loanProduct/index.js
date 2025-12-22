const createRoutes = require("./create");
const listRoutes = require("./list");
const updateRoutes = require("./update");
const statusRoutes = require("./toggleStatus");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function lenderLoanProductsRoutes(fastify) {
  fastify.register(createRoutes, { prefix: "/create" });
  fastify.register(listRoutes, { prefix: "/list" });
  fastify.register(updateRoutes, { prefix: "/update" });
  fastify.register(statusRoutes, { prefix: "/status" });
}

module.exports = lenderLoanProductsRoutes;
