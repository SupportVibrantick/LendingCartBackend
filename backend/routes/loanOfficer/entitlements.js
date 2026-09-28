const { sendOrgEntitlements } = require("../common/sendOrgEntitlements");

async function loanOfficerEntitlementsRoutes(fastify) {
  fastify.get(
    "/",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireRole(["BROKER_OFFICER"]),
      ],
      schema: {
        tags: ["Loan Officer -> Entitlements"],
        summary:
          "Get org feature entitlements for the loan officer's broker org",
      },
    },
    async (req, reply) => sendOrgEntitlements(fastify, req, reply),
  );
}

module.exports = loanOfficerEntitlementsRoutes;
