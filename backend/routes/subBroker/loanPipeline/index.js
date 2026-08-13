const getApplicationsRoute = require("./getApplications");
const pipelineStatsRoute = require("./pipelineStats");

async function subBrokerLoanPipelineRoutes(fastify, options) {
  fastify.register(getApplicationsRoute);
  fastify.register(pipelineStatsRoute);
  fastify.register(async function clientApplicationLinkScope(scope) {
    scope.addHook("preHandler", scope.authenticate);
    scope.addHook("preHandler", scope.requireRole(["SUB_BROKER"]));
    await scope.register(
      require("../../broker/loanPipeline/getClientApplicationLink")({
        sourcePortal: "CO_BROKER",
      }),
    );
  });
}

module.exports = subBrokerLoanPipelineRoutes;
