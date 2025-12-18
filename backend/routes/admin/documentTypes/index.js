const createRoutes = require("./create");
const readRoutes = require("./list");
const updateRoutes = require("./update");
const statusRoutes = require("./toggleStatus");

async function documentTypes(fastify, options) {
  fastify.register(createRoutes, { prefix: "/create" });
  fastify.register(readRoutes, { prefix: "/read" });
  fastify.register(updateRoutes, { prefix: "/update" });
  fastify.register(statusRoutes, { prefix: "/status" });
}

module.exports = documentTypes;
