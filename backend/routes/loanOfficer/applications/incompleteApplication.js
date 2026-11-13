const { officerPreHandler } = require("../../../services/broker/loanOfficerAccess");
const {
  registerIncompleteApplicationRoutes,
} = require("../../applications/incompleteApplicationRoutes");

module.exports = async function loanOfficerIncompleteApplication(fastify) {
  registerIncompleteApplicationRoutes(fastify, {
    actor: "loanOfficer",
    preHandler: officerPreHandler(fastify, "CREATE_APPLICATION"),
  });
};
