async function loanAiUsersRoutes(fastify) {
  fastify.register(require("./list"), { prefix: "/read" });
  fastify.register(require("./stats"), { prefix: "/stats" });
}

module.exports = loanAiUsersRoutes;
