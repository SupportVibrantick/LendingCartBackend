// backend/routes/admin/auth/index.js
const { registerAuthLogoutRoute } = require("../../common/authLogoutRoute");

module.exports = async function adminAuthRoutes(fastify, opts) {
  // register individual route files that use module.exports too
  fastify.register(require("./login"), { prefix: "" });
  fastify.register(require("./register"), { prefix: "" });
  fastify.register(require("./me"), { prefix: "" });
  fastify.register(require("./updateProfile"), { prefix: "/update" });
  fastify.register(require("./impersonate"),{prefix:""});
  fastify.register(require("./stopImpersonation"),{prefix:""});
  registerAuthLogoutRoute(fastify, {
    dashboard: "PLATFORM",
    preHandler: [fastify.authenticate],
  });
};
