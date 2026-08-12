module.exports = async function (fastify) {

  fastify.register(require("./stats"), { prefix: "/stats" });
  fastify.register(require("./allLeads"), { prefix: "/leads" });
  fastify.register(require("./commonStatus"), { prefix: "/leads" });
  fastify.register(require("./leadCrud"), { prefix: "/leads" });

  fastify.register(require("./CommercialLendingMastery"), {
    prefix: "/commercial-lending-mastery",
  });

  fastify.register(require("./ClmLandingPage"), {
    prefix: "/clm-landing-page",
  });

  fastify.register(require("./AdminCreateLeads"), {
    prefix: "/crm",
  });

  fastify.register(require("./LoanAiBookDemo"), {
    prefix: "/loan-ai-book-demo",
  });
};
