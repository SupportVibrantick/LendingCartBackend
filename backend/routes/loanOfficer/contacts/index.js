const { officerPreHandler } = require("../../../services/broker/loanOfficerAccess");

async function loanOfficerContactsRoutes(fastify) {
  for (const handler of officerPreHandler(fastify)) {
    fastify.addHook("preHandler", handler);
  }

  await fastify.register(require("./create"));
  await fastify.register(require("./list"));
  await fastify.register(require("./delete"));
  await fastify.register(require("./update"));
}

module.exports = loanOfficerContactsRoutes;
