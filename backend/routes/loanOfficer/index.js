const loanOfficerAuthRoutes = require("./auth");
const loanOfficerLoanPipelineRoutes = require("./loanPipeline");
const loanOfficerApplicationsRoutes = require("./applications");
const loanOfficerContactsRoutes = require("./contacts");
const loanOfficerLenderDiscoveryRoutes = require("./lenderDiscovery");
const loanOfficerMessagingRoutes = require("./messaging");
const loanOfficerNotificationRoutes = require("./notifications");
const loanOfficerCommissionRoutes = require("./commissions");

async function loanOfficerRoutes(fastify) {
  fastify.register(loanOfficerAuthRoutes, { prefix: "/auth" });
  fastify.register(loanOfficerLoanPipelineRoutes, { prefix: "/loan-pipeline" });
  fastify.register(loanOfficerApplicationsRoutes, { prefix: "/applications" });
  fastify.register(loanOfficerContactsRoutes, { prefix: "/contacts" });
  fastify.register(loanOfficerLenderDiscoveryRoutes, { prefix: "/lender-discovery" });
  fastify.register(loanOfficerMessagingRoutes, { prefix: "/messaging" });
  fastify.register(loanOfficerNotificationRoutes, { prefix: "/notifications" });
  fastify.register(loanOfficerCommissionRoutes, { prefix: "/commissions" });
}

module.exports = loanOfficerRoutes; 
