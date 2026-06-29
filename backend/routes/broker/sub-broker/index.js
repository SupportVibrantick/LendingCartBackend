async function subBrokerRoutes(fastify) {
  fastify.register(require("./createSubBroker"), {
    prefix: "/create",
  });

  fastify.register(require("./list"), {
    prefix: "/list",
  });

  fastify.register(require("./formOptions"));

  fastify.register(require("./status"), {});

  fastify.register(require("./update"), {});

  fastify.register(require("./getSubBrokerById"), {});

  fastify.register(require("./deleteSubBroker"), {});

  fastify.register(require("./assignApplication"));

  fastify.register(require("./impersonate"), {});
}

module.exports = subBrokerRoutes;
