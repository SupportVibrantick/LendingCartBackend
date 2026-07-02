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

  // -------------------------
  // Protected broker routes
  // -------------------------
  fastify.register(async function brokerProtected(instance) {
    // Verify JWT + broker org
    instance.register(require("../../plugins/verifyBroker"));
    instance.register(require("../../plugins/verifyBrokerSubscription"));

    instance.addHook("preHandler", async (req, reply) => {
      // Allow Swagger
      if (
        req.url.startsWith("/docs") ||
        req.url.startsWith("/swagger") ||
        req.url.includes("/docs") ||
        req.url.includes("swagger")
      ) {
        return;
      }

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
    // Later extensions
    // instance.register(documentRoutes, { prefix: "/documents" });
    // instance.register(applicationRoutes, { prefix: "/applications" });
  });
};
