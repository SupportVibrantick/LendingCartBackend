const { officerPreHandler } = require("../../../services/broker/loanOfficerAccess");

async function loanOfficerContactsRoutes(fastify) {
  for (const handler of officerPreHandler(fastify)) {
    fastify.addHook("preHandler", handler);
  }

  fastify.register(require("./create"));
  fastify.register(require("./list"));
  fastify.register(require("./delete"));
  fastify.register(require("./update"));
}

module.exports = loanOfficerContactsRoutes;
