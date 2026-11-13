const {
  registerIncompleteApplicationRoutes,
} = require("../../applications/incompleteApplicationRoutes");

module.exports = async function incompleteApplication(fastify) {
  registerIncompleteApplicationRoutes(fastify, { actor: "broker" });
};
