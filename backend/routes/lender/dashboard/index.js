const getOverviewStatsRoutes = require("./getOverviewStats");
const getPipelinePerformanceRoutes = require("./getPipelinePerformance");

async function dashboardRoutes(fastify) {
  fastify.register(getOverviewStatsRoutes, { prefix: "/overview-stats" });
  fastify.register(getPipelinePerformanceRoutes, { prefix: "/pipeline-performance" });
}

module.exports = dashboardRoutes;
