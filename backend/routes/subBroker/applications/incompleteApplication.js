const {
  registerIncompleteApplicationRoutes,
} = require("../../applications/incompleteApplicationRoutes");

module.exports = async function subBrokerIncompleteApplication(fastify) {
  registerIncompleteApplicationRoutes(fastify, { actor: "coBroker" });
};
