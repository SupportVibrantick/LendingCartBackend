const subBrokerAuthRoutes = require("./auth/index");

const subBrokerLoanPipelineRoutes =
  require("./loanPipeline");

async function subBrokerRoutes(
  fastify,
  options
) {
  // AUTH
  fastify.register(
    subBrokerAuthRoutes,
    {
      prefix: "/auth",
    }
  );

  // LOAN PIPELINE
  fastify.register(
    subBrokerLoanPipelineRoutes,
    {
      prefix: "/loan-pipeline",
    }
  );
}

module.exports = subBrokerRoutes;