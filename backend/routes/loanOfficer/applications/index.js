const { registerOfficerRouteGuards } = require("../../../services/broker/loanOfficerAccess");

async function loanOfficerApplicationsRoutes(fastify) {
  registerOfficerRouteGuards(fastify, "VIEW_APPLICATIONS");

  await fastify.register(require("./submit"));
  await fastify.register(require("./activeApplication"));
  await fastify.register(require("./editSubmittedApplication"));
  await fastify.register(require("./viewSubmission"));
}

module.exports = loanOfficerApplicationsRoutes;
