async function loanAiAuthRoutes(fastify) {
  fastify.register(require("./register"), { prefix: "/register" });
  fastify.register(require("./login"), { prefix: "/login" });
  fastify.register(require("./me"), { prefix: "/me" });
}

module.exports = loanAiAuthRoutes;
