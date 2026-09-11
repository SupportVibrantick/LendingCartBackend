async function subBrokerBorrowersRoutes(fastify) {
  await fastify.register(require("./impersonate"));
  await fastify.register(require("./list"));
  await fastify.register(require("../../broker/borrowers/updateIdentity"));
}

module.exports = subBrokerBorrowersRoutes;
