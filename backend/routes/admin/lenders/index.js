const readRoutes = require("./read");
const createRoutes = require("./create");
const deleteRoutes = require("./status");
const updateRoutes = require("./update");
const harddeleteRoutes = require("./hardDelete");
const transferPortalRoutes = require("./transferPortal");
async function lendersRoutes(fastify, options) {
  fastify.register(createRoutes, { prefix: "/create" });
  fastify.register(readRoutes, { prefix: "/read" });
  fastify.register(deleteRoutes, { prefix: "/status" });
  fastify.register(updateRoutes, { prefix: "/update" });
  fastify.register(harddeleteRoutes,{prefix:"/delete"});
  fastify.register(transferPortalRoutes, { prefix: "/transfer-portal" });
}

module.exports =lendersRoutes;
