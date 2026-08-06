const { registerOfficerRouteGuards } = require("../../../services/broker/loanOfficerAccess");

async function loanOfficerContactsRoutes(fastify) {
  registerOfficerRouteGuards(fastify, "VIEW_CONTACTS");

  await fastify.register(require("./create"));
  await fastify.register(require("./list"));
  await fastify.register(require("./delete"));
  await fastify.register(require("./update"));
}

module.exports = loanOfficerContactsRoutes;
