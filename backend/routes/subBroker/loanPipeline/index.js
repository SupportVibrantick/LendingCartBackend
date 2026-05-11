const getApplicationsRoute =
  require("./getApplications");

async function subBrokerLoanPipelineRoutes(
  fastify,
  options
) {
  // GET APPLICATIONS
  fastify.register(
    getApplicationsRoute
  );
}

module.exports =
  subBrokerLoanPipelineRoutes;