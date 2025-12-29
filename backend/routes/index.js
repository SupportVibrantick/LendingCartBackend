const adminRoutes = require("../routes/admin");
const lenderRoutes = require("../routes/lender");
const commonDocumentTypes = require("../routes/common/documentTypes");
const commonLoanProducts = require("./common/loanProducts");
const landingPagesLeads = require("./public/LandingPagesLeads");

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
}

module.exports = indexRoutes;
