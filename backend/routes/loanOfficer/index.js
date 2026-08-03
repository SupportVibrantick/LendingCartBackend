async function loanOfficerRoutes(fastify) {
  await fastify.register(require("./auth"), { prefix: "/auth" });
  await fastify.register(require("./loanPipeline"), { prefix: "/loan-pipeline" });
  await fastify.register(require("./applications"), { prefix: "/applications" });
  await fastify.register(require("./contacts"), { prefix: "/contacts" });
  await fastify.register(require("./lenderDiscovery"), {
    prefix: "/lender-discovery",
  });
  await fastify.register(require("./messaging"), { prefix: "/messaging" });
  await fastify.register(require("./notifications"), { prefix: "/notifications" });
  await fastify.register(require("./commissions"), { prefix: "/commissions" });
  await fastify.register(require("./dashboard"), { prefix: "/dashboard" });
}

module.exports = loanOfficerRoutes;
