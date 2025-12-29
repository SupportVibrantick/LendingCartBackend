module.exports = async function (fastify) {
  fastify.register(require("./CommercialLendingMastery"), {
    prefix: "/commercial-lending-mastery",
  });

  fastify.register(require("./ClmLandingPage"), {
    prefix: "/clm-landing-page",
  });
};
