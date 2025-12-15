// backend/routes/admin/index.js
const brokerRoutes = require("./brokers");
const lendersRoutes = require("./lenders");
const logsRoutes = require("./logs/logs.js"); 
const statsRoutes = require("./stats"); 
const loanProductsRoutes = require("./loanProducts");
const lenderProducts = require("./lenderProducts");
const adminUserRoutes = require("./adminUsers");

// Registers auth sub-router under /admin/auth
module.exports = async function adminRoutes(fastify, opts) {
  // auth folder index (CommonJS)
  fastify.register(require("./auth"), { prefix: "/auth" });

  // Protected routes
  fastify.register(async function rolesGroup(instance, opts) {

    instance.register(require("../../plugins/verifySuperAdmin"));
    // Combine both middlewares in one preHandler
    instance.addHook("preHandler", async (req, reply) => {
      // Allow Swagger UI requests to pass without token 
      if (
        req.url.startsWith("/docs") ||
        req.url.startsWith("/swagger") ||
        req.url.includes("/docs") ||
        req.url.includes("swagger")
      ) {
        return;
      }

      await instance.authenticate(req, reply);
      // requireRole returns a handler; invoke it
      const roleChecker = instance.requireRole(["PLATFORM_ADMIN"]);
      await roleChecker(req, reply); // <-- IMPORTANT: invoke the returned handler
    });

    instance.register(brokerRoutes, { prefix: "/brokers" });
    instance.register(lendersRoutes, { prefix: "/lenders" });
    instance.register(logsRoutes, { prefix: "/logs" });
    instance.register(statsRoutes, { prefix: "/stats" });
    instance.register(loanProductsRoutes,{prefix:"/loan-products"});
    instance.register(lenderProducts,{prefix:"/lender-products"});
    instance.register(adminUserRoutes,{prefix:"/admin-user"});
  });
};
