const verifyLoanAi = require("../../../plugins/verifyLoanAi");

async function loanAiRoutes(fastify) {
  fastify.register(verifyLoanAi);
  fastify.register(require("./auth"), { prefix: "/auth" });
  fastify.register(require("./subscriptions"), { prefix: "/subscriptions" });
}

module.exports = loanAiRoutes;
