async function adminAuthRoutes(fastify, options) {
  fastify.register(require("./login"), { prefix: "/login" });
}

module.exports = adminAuthRoutes;