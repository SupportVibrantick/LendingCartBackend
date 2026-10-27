const validateRoute = require("./validate");
const registerRoute = require("./register");

module.exports = async function publicBrokerTeamInviteRoutes(fastify) {
  fastify.register(validateRoute);
  fastify.register(registerRoute);
};
