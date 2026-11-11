const readRoutes = require("./read");
const createRoutes = require("./create");
const deleteRoutes = require("./status");
const updateRoutes = require("./update");
const harddeleteRoutes = require("./hardDelete");
const softDeleteRoutes = require("./softDelete");
const transferPortalRoutes = require("./transferPortal");
async function lendersRoutes(fastify, options) {
  fastify.register(createRoutes, { prefix: "/create" });
  fastify.register(readRoutes, { prefix: "/read" });
  fastify.register(deleteRoutes, { prefix: "/status" });
  fastify.register(updateRoutes, { prefix: "/update" });
  // Soft-delete first so DELETE /delete/:id is the Admin Portal path.
  // Hard wipe remains at DELETE /delete/:id/hard (ops/dev).
  fastify.register(softDeleteRoutes, { prefix: "/delete" });
  fastify.register(harddeleteRoutes, { prefix: "/delete" });
  fastify.register(transferPortalRoutes, { prefix: "/transfer-portal" });
}

module.exports =lendersRoutes;
