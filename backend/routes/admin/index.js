// routes/admin/index.js
const {
  verifyToken /*, authorizeRoles - decide if needed here or per route */,
} = require("../../middleware/authMiddleware");
const authRoutes = require("./auth/index");
// const rolesRoutes = require("./roles/index");

async function adminRoutes(fastify, options) {
  // Register /admin/auth routes (path will be /admin/auth/*)
  fastify.register(authRoutes, { prefix: "/auth" });

  // Create a sub-router for /admin/roles/* and apply middleware to it
  fastify.register(async function rolesGroup(instance, opts) {
    instance.addHook("preHandler", verifyToken);

    // instance.register(rolesRoutes, { prefix: "/roles" });
    
  });
}

module.exports = adminRoutes;