const { officerPreHandler } = require("../../../services/broker/loanOfficerAccess");

async function loanOfficerApplicationsRoutes(fastify) {
  for (const handler of officerPreHandler(fastify)) {
    fastify.addHook("preHandler", handler);
  }

  await fastify.register(require("./submit"));
  await fastify.register(require("./activeApplication"));
  await fastify.register(require("./editSubmittedApplication"));
  await fastify.register(require("./viewSubmission"));
}

module.exports = loanOfficerApplicationsRoutes;
