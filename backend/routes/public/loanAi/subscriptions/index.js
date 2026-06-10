async function loanAiSubscriptionRoutes(fastify) {
  fastify.register(require("./purchase"), { prefix: "/purchase" });
}

module.exports = loanAiSubscriptionRoutes;
