const { officerPreHandler } = require("../../../services/broker/loanOfficerAccess");

async function loanOfficerLenderDiscoveryRoutes(fastify) {
  for (const handler of officerPreHandler(fastify)) {
    fastify.addHook("preHandler", handler);
  }

  fastify.register(require("./findEligible"));
  fastify.register(require("./sendToLenders"));
}

module.exports = loanOfficerLenderDiscoveryRoutes;
