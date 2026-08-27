// backend/routes/lender/index.js

const authRoutes = require("./auth");
const loanProductRoutes = require("./loanProduct");
const documentConfigRoutes = require("./documentConfig");
const eligibilityRoutes = require("./eligibility");
const brokerRoutes = require("./broker");
const loanPipelineRoutes = require("./loanPipeLine");
const notificationRoutes = require("./notifications");
const dashboardRoutes = require("./dashboard/index");

// const brokerRoutes = require("./broker");
// const commonRoutes = require("./common");

const { LENDER_PORTAL_ROLES } = require("../../utils/lender/lenderTeamRoles");
const {
  canLenderMutate,
  denyLenderMutation,
} = require("../../utils/lender/lenderAccess");

module.exports = async function lenderRoutes(fastify, opts) {
  // -------------------------
  // Public auth routes
  // -------------------------
  fastify.register(authRoutes, { prefix: "/auth" });

  // -------------------------
  // Protected lender routes
  // -------------------------
  fastify.register(async function lenderProtected(instance) {
    //  Verify JWT + role
    instance.register(require("../../plugins/verifyLender"));

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
      const roleChecker = instance.requireRole(LENDER_PORTAL_ROLES);
      await roleChecker(req, reply);

      if (!canLenderMutate(req)) {
        return denyLenderMutation(reply);
      }
    });

    instance.register(require("./users"), {
      prefix: "/users",
    });

    // -------------------------
    // Lender feature modules
    // -------------------------
    instance.register(loanProductRoutes, {
      prefix: "/loan-products",
    });

    instance.register(documentConfigRoutes, {
      prefix: "/document-config",
    });

    instance.register(eligibilityRoutes, {
      prefix: "/eligibility-engine",
    });

    instance.register(brokerRoutes, {
      prefix: "/brokers",
    });

    instance.register(loanPipelineRoutes, {
      prefix: "/loan-pipeline",
    });

    instance.register(notificationRoutes, {
      prefix: "/notifications",
    });

    instance.register(dashboardRoutes, {
      prefix: "/dashboard",
    });

    instance.register(require("./branding"), {
      prefix: "/branding",
    });

    instance.register(require("./signFormTemplates"), {
      prefix: "/sign-form-templates",
    });

    // Later:
    // instance.register(brokerRoutes, { prefix: "/brokers" });
    // instance.register(commonRoutes, { prefix: "/common" });
    // instance.register(require("./applications"), { prefix: "/applications" });
  });
};
