// backend/routes/broker/stats/index.js

const listStatsRoute = require("./list");

module.exports = async function brokerStatsRoutes(fastify) {
  fastify.register(listStatsRoute);
};