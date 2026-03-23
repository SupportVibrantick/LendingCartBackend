async function clientPortalRoutes(fastify) {

  // Get loan details via token
  fastify.register(require("./getClientLoanDetails"), {
    prefix: "/loan",
  });

  //  Future APIs (you will add later)
  // fastify.register(require("./uploadDocuments"), { prefix: "/upload" });
  // fastify.register(require("./getNotifications"), { prefix: "/notifications" });

}

module.exports = clientPortalRoutes;