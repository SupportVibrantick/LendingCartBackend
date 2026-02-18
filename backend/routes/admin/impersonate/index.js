const brokerListRoutes = require("./broker");
const lenderListRoutes = require("./lender");

async function lendersRoutes(fastify, options) {
  fastify.register(brokerListRoutes);
  fastify.register(lenderListRoutes);
}

module.exports =lendersRoutes;
