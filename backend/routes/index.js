const adminRoutes = require("../routes/admin");
const lenderRoutes = require("../routes/lender");
const brokerRoutes = require("../routes/broker");
const commonDocumentTypes = require("../routes/common/documentTypes");
const commonLoanProducts = require("./common/loanProducts");
const landingPagesLeads = require("./public/LandingPagesLeads");
const publicBrokerApplications = require("./public/broker/applications");

async function indexRoutes(fastify, options) {
  fastify.get("/", async (request, reply) => {
    request.log.info("Home page accessed");
    return reply.view("index.pug", {
      title: "Welcome to LendingCart Server",
      message: "A self-hosted application server",
    });
  });

  fastify.register(landingPagesLeads, {
    prefix: "/public/landing-leads",
  });

  fastify.register(publicBrokerApplications, {
  prefix: "/public/broker/applications",
});


  //  Common (read-only, role-based)
  fastify.register(commonDocumentTypes, {
    prefix: "/document-types",
  });

  fastify.register(commonLoanProducts, {
    prefix: "/common/loan-products",
  });

  //  Role-specific
  fastify.register(adminRoutes, { prefix: "/admin" });
  fastify.register(lenderRoutes, { prefix: "/lender" });
  fastify.register(brokerRoutes, { prefix: "/broker" });
}

module.exports = indexRoutes;
