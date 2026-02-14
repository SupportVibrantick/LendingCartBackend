const listLogsRoute = require("./list");

module.exports = async function brokerLogsRoutes(fastify) {
  fastify.register(listLogsRoute);

};