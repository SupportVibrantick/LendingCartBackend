// backend/routes/broker/index.js
const authRoutes = require("./auth");
const lenderRoutes = require("./lenders");
const whiteLabelRoutes = require("./whiteLabelSettings");
const applicationRoutes = require("./applications");
const websiteBuilderRoutes = require("./websiteBuilder");
const templateRoutes = require("./templates");

// later you can add:
// const documentRoutes = require("./documents");
// const applicationRoutes = require("./applications");

module.exports = async function brokerRoutes(fastify, opts) {
  // -------------------------
  // Public auth routes
  // -------------------------
  fastify.register(authRoutes, { prefix: "/auth" });

  // Public GHL OAuth callback (GoHighLevel redirect — no Bearer token)
  fastify.register(require("./integrations/ghl/callback"), {
    prefix: "/integrations/ghl",
  });

  // Neutral OAuth callback (GHL Marketplace rejects URLs containing "ghl")
  fastify.register(require("./integrations/ghl/callback"), {
    prefix: "/integrations/oauth",
  });

  // -------------------------
  // Protected broker routes
  // -------------------------
  fastify.register(async function brokerProtected(instance) {
    // Verify JWT + broker org
    instance.register(require("../../plugins/verifyBroker"));
    instance.register(require("../../plugins/verifyBrokerSubscription"));

    instance.addHook("preHandler", async (req, reply) => {
      // JWT auth
      await instance.authenticate(req, reply);

      // Role guard
      const roleChecker = instance.requireRole([
        "BROKER_ADMIN",
        "BROKER_OFFICER",
        "SUB_BROKER",
      ]);
      await roleChecker(req, reply);
    });

    // -------------------------
    // Broker feature modules
    // -------------------------

    // Lenders visible to broker
    instance.register(lenderRoutes, {
      prefix: "/lenders",
    });

    instance.register(whiteLabelRoutes, {
      prefix: "/white-label",
    });

    instance.register(applicationRoutes, {
      prefix: "/applications",
    });

    instance.register(templateRoutes, {
      prefix: "/templates",
    });

    instance.register(websiteBuilderRoutes, {
      prefix: "/website-builder",
    });

    instance.register(require("./lenderDiscovery"), {
      prefix: "/lender-discovery",
    });

    instance.register(require("./users"), {
      prefix: "/users",
    });

    instance.register(require("./contacts"), {
      prefix: "/contacts",
    });

    instance.register(require("./borrowers"), {
      prefix: "/borrowers",
    });

    instance.register(require("./campaign"), {
      prefix: "/campaign",
    });

    instance.register(require("./sub-broker"), {
      prefix: "/sub-broker",
    });
    instance.register(require("./globalSearch"), {
      prefix: "/global-search",
    });
    instance.register(require("./loanOfficerActivity"), {
      prefix: "/loan-officer-activity",
    });
    instance.register(require("./loanPipeline"), { prefix: "/loan-pipeline" });
    instance.register(require("./commissions"), { prefix: "/commissions" });
    instance.register(require("./logs"), { prefix: "/logs" });
    instance.register(require("./stats"), { prefix: "/stats" });
    instance.register(require("./notifications"), {
      prefix: "/notifications",
    });
    instance.register(require("./documentTypes"), {
      prefix: "/document-types",
    });

    instance.register(require("./integrations"), {
      prefix: "/integrations",
    });
    // Later extensions
    // instance.register(documentRoutes, { prefix: "/documents" });
    // instance.register(applicationRoutes, { prefix: "/applications" });
  });
};
