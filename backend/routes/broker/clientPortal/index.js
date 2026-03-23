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

  //  Future APIs (you will add later)
  // fastify.register(require("./uploadDocuments"), { prefix: "/upload" });
  // fastify.register(require("./getNotifications"), { prefix: "/notifications" });

}

module.exports = clientPortalRoutes;