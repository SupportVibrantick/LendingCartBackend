const readRoutes = require("./read");
const createRoutes = require("./create");
// const deleteRoutes = require("./delete");
const updateRoutes = require("./update");

async function brokersRoutes(fastify, options) {
  fastify.register(createRoutes, { prefix: "/create" });
  fastify.register(readRoutes, { prefix: "/read" });
//   fastify.register(deleteRoutes, { prefix: "/delete" });
  fastify.register(updateRoutes, { prefix: "/update" });
}

module.exports = brokersRoutes;