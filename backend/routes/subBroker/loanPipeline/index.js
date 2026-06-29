const getApplicationsRoute =
  require("./getApplications");
const pipelineStatsRoute = require("./pipelineStats");

async function subBrokerLoanPipelineRoutes(
  fastify,
  options
) {
  fastify.register(getApplicationsRoute);
  fastify.register(pipelineStatsRoute);
}

module.exports =
  subBrokerLoanPipelineRoutes;