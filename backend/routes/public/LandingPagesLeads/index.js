module.exports = async function (fastify) {
  fastify.register(require("./CommercialLendingMastery"), {
    prefix: "/commercial-lending-mastery",
  });

  fastify.register(require("./ClmLandingPage"), {
    prefix: "/clm",
  });

  fastify.register(require("./LoanAiBookDemo"), {
    prefix: "/loan-ai-book-demo",
  });
};
