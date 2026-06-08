async function loanOfficerRoutes(fastify) {
  fastify.register(require("./list"));
  fastify.register(require("./status"));
}

module.exports = loanOfficerRoutes;
