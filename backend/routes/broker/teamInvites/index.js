const createRoute = require("./create");

module.exports = async function brokerTeamInviteRoutes(fastify) {
  fastify.register(createRoute);
};
