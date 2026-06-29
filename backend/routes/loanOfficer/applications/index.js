const { officerPreHandler } = require("../../../services/loanOfficerAccess");

async function loanOfficerApplicationsRoutes(fastify) {
  for (const handler of officerPreHandler(fastify)) {
    fastify.addHook("preHandler", handler);
  }

  fastify.register(require("./submit"));
  fastify.register(require("./activeApplication"));
  fastify.register(require("./editSubmittedApplication"));
  fastify.register(require("./viewSubmission"));
}

module.exports = loanOfficerApplicationsRoutes;
