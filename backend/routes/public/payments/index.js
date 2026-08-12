const verifyLoanAi = require("../../../plugins/verifyLoanAi");

/**
 * Alias route: POST /public/payments/checkout
 * Same handler as POST /public/loan-ai/subscriptions/checkout
 */
async function publicPaymentsRoutes(fastify) {
  fastify.register(verifyLoanAi);
  fastify.register(require("../loanAi/subscriptions/checkout"), {
    prefix: "/checkout",
  });
}

module.exports = publicPaymentsRoutes;
