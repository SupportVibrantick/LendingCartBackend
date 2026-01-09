async function brokerLenderRoutes(fastify) {
  fastify.register(require("./connected"), { prefix: "/connected" });
  fastify.register(require("./invites"), { prefix: "/invites" });
  fastify.register(require("./acceptInvite"), { prefix: "/accept" });
  fastify.register(require("./rejectInvite"), { prefix: "/reject" });
  fastify.register(require("./products"),{prefix:"/products"});
}

module.exports = brokerLenderRoutes;
