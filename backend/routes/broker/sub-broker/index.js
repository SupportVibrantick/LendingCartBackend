async function subBrokerRoutes(fastify) {
  fastify.register(require("./createSubBroker"), {
    prefix: "/create",
  });

  fastify.register(require("./list"), {
    prefix: "/list",
  });

  fastify.register(require("./status"), {});

  fastify.register(require("./update"), {});

  fastify.register(require("./getSubBrokerById"), {});

  fastify.register(require("./assignApplication"));
}

module.exports = subBrokerRoutes;
