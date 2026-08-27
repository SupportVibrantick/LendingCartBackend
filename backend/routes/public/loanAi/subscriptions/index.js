async function loanAiSubscriptionRoutes(fastify) {
  fastify.register(require("./purchase"), { prefix: "/purchase" });
  fastify.register(require("./checkout"), { prefix: "/checkout" });
  fastify.register(require("./brokerSetupLink"), {
    prefix: "/broker-setup-link",
  });
}

module.exports = loanAiSubscriptionRoutes;
