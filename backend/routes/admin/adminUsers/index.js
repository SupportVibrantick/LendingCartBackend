const readRoutes = require("./read");
const createRoutes = require("./create");
const updateRoutes = require("./update");
const statusRoutes = require("./status");
const listPermissionsRoutes = require("./listPermissions");

async function adminUserRoutes(fastify) {
  fastify.register(createRoutes);
  fastify.register(readRoutes);
  fastify.register(updateRoutes);
  fastify.register(statusRoutes);
  fastify.register(listPermissionsRoutes);
}

module.exports = adminUserRoutes;
