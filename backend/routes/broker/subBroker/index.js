const assignApplicationRoute =
  require("./assignApplication");

async function subBrokerRoutes(
  fastify,
  options
) {
  fastify.register(
    assignApplicationRoute
  );
}

module.exports =
  subBrokerRoutes;