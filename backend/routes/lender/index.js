// backend/routes/lender/index.js
const authRoutes = require("./auth");
// const brokerRoutes = require("./broker");     // if lender interacts with brokers
// const commonRoutes = require("./common");     // shared lender utilities
// add more lender modules here later (products, applications, etc.)

module.exports = async function lenderRoutes(fastify, opts) {
  // -------------------------
  // Public auth routes
  // -------------------------
  fastify.register(authRoutes, { prefix: "/auth" });

  // -------------------------
  // Protected lender routes
  // -------------------------
  fastify.register(async function lenderProtected(instance) {

    // 🔐 Verify JWT + role
    instance.register(require("../../plugins/verifyLender"));

    instance.addHook("preHandler", async (req, reply) => {
      // Allow Swagger
      if (
        req.url.startsWith("/docs") ||
        req.url.startsWith("/swagger") ||
        req.url.includes("/docs") ||
        req.url.includes("swagger")
      ) {
        return;
      }

      // Auth check
      await instance.authenticate(req, reply);

      // Role check
      const roleChecker = instance.requireRole([
        "LENDER_ADMIN",
        "LENDER_UNDERWRITER",
      ]);
      await roleChecker(req, reply);
    });

    // -------------------------
    // Lender modules
    // -------------------------
    // instance.register(brokerRoutes, { prefix: "/brokers" });
    // instance.register(commonRoutes, { prefix: "/common" });

    // Later you will add:
    // instance.register(require("./products"), { prefix: "/products" });
    // instance.register(require("./applications"), { prefix: "/applications" });
  });
};
