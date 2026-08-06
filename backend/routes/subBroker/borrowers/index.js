async function subBrokerBorrowersRoutes(fastify) {
  await fastify.register(require("./impersonate"));
  await fastify.register(require("./list"));
}

module.exports = subBrokerBorrowersRoutes;
