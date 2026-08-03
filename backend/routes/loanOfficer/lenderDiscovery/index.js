const { registerOfficerRouteGuards } = require("../../../services/broker/loanOfficerAccess");

async function loanOfficerLenderDiscoveryRoutes(fastify) {
  registerOfficerRouteGuards(fastify, "VIEW_APPLICATIONS");

  await fastify.register(require("./findEligible"));
  await fastify.register(require("./sendToLenders"));
}

module.exports = loanOfficerLenderDiscoveryRoutes;
