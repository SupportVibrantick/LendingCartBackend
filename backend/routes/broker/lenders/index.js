async function brokerLenderRoutes(fastify) {
  fastify.register(require("./connected"), { prefix: "/connected" });
  fastify.register(require("./invite"));
  fastify.register(require("./find"));
  fastify.register(require("./status"));
  fastify.register(require("./invites"), { prefix: "/invites" });
  fastify.register(require("./inviteList"), { prefix: "/invites" });
  fastify.register(require("./acceptInvite"), { prefix: "/accept" });
  fastify.register(require("./rejectInvite"), { prefix: "/reject" });
  fastify.register(require("./products"),{prefix:"/products"});
}

module.exports = brokerLenderRoutes;
