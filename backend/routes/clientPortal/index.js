async function clientPortalRoutes(fastify) {

  // Get loan details via token
  fastify.register(require("./getClientLoanDetails"), {
    prefix: "/loan",
  });

  fastify.register(require("./checkUserByToken"), {
    prefix: "/check-user",
  });

  fastify.register(require("./setPassword"), {
  prefix: "/auth",
});

fastify.register(require("./login"), {
  prefix: "/auth",
});

fastify.register(require("./verifyToken"));
fastify.register(require("./uploadDocuments"));
fastify.register(require("./submitApplication"));
fastify.register(require("./getClientApplications"));
fastify.register(require("./getClientProfile"));

fastify.register(require("./getSingleApplication"));
fastify.register(require("./getClientFeeAgreement"));
fastify.register(require("./downloadFeeAgreementPdf"));
fastify.register(require("./notifications"), { prefix: "/notifications" });
  //  Future APIs (you will add later)
  // fastify.register(require("./uploadDocuments"), { prefix: "/upload" });
fastify.register(require("./signFeeAgreement"));
fastify.register(require("./signDocuments"));
}

module.exports = clientPortalRoutes;