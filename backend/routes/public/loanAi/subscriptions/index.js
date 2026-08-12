async function loanAiSubscriptionRoutes(fastify) {
  fastify.register(require("./purchase"), { prefix: "/purchase" });
  fastify.register(require("./checkout"), { prefix: "/checkout" });
}

module.exports = loanAiSubscriptionRoutes;
