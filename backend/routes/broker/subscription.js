const {
  getAddOnUpgradeOptions,
  startAddOnUpgradeCheckout,
} = require("../../services/subscription/addOnUpgradeCheckout");
const {
  startPlanUpgradeCheckout,
} = require("../../services/subscription/planUpgradeCheckout");
const {
  getClmSubscriptionStatus,
  discontinueClmSoftTrial,
} = require("../../services/subscription/clmDiscontinue");

async function brokerSubscriptionRoutes(fastify) {
  fastify.get(
    "/status",
    {
      schema: {
        tags: ["Broker -> Subscription"],
        summary: "CLM / soft-trial subscription status for banner + Discontinue",
      },
    },
    async (req, reply) => {
      try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) {
          return reply.code(400).send({
            success: false,
            message: "Organization missing",
          });
        }

        const data = await getClmSubscriptionStatus(
          fastify.prisma,
          organizationId,
        );
        return reply.send({ success: true, data });
      } catch (err) {
        req.log.error(err);
        return reply.code(500).send({
          success: false,
          message: "Failed to load subscription status",
        });
      }
    },
  );

  fastify.get(
    "/addons",
    {
      schema: {
        tags: ["Broker -> Subscription"],
        summary:
          "Current plan add-ons, owned items, and available upgrades for purchase",
      },
    },
    async (req, reply) => {
      try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) {
          return reply.code(400).send({
            success: false,
            message: "Organization missing",
          });
        }

        const data = await getAddOnUpgradeOptions(
          fastify.prisma,
          organizationId,
        );
        return reply.send({ success: true, data });
      } catch (err) {
        const status = err.statusCode || 500;
        req.log.error(err);
        return reply.code(status).send({
          success: false,
          code: err.code || "ADDONS_LOAD_FAILED",
          message: err.message || "Failed to load add-ons",
        });
      }
    },
  );

  fastify.post(
    "/addons/checkout",
    {
      schema: {
        tags: ["Broker -> Subscription"],
        summary:
          "Create Stripe (or GHL) checkout for new add-ons / additional seats",
        body: {
          type: "object",
          properties: {
            addOnCodes: {
              type: "array",
              items: { type: "string" },
            },
            extraUserTotal: { type: "number" },
            successUrl: { type: "string" },
            cancelUrl: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) {
          return reply.code(400).send({
            success: false,
            message: "Organization missing",
          });
        }

        const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
        if (!roles.includes("BROKER_ADMIN")) {
          return reply.code(403).send({
            success: false,
            code: "FORBIDDEN",
            message: "Only the broker admin can purchase add-ons.",
          });
        }

        const body = req.body || {};
        const result = await startAddOnUpgradeCheckout(fastify.prisma, {
          organizationId,
          actorUser: {
            email: req.user?.email,
            firstName: req.user?.firstName,
            lastName: req.user?.lastName,
            name: req.user?.name,
          },
          addOnCodes: Array.isArray(body.addOnCodes) ? body.addOnCodes : [],
          extraUserTotal:
            body.extraUserTotal != null ? Number(body.extraUserTotal) : undefined,
          successUrl: body.successUrl || undefined,
          cancelUrl: body.cancelUrl || undefined,
        });

        return reply.send({
          success: true,
          data: result,
        });
      } catch (err) {
        const status = err.statusCode || 500;
        req.log.error(err);
        return reply.code(status).send({
          success: false,
          code: err.code || "ADDON_CHECKOUT_FAILED",
          message: err.message || "Failed to start add-on checkout",
        });
      }
    },
  );

  fastify.post(
    "/plan/upgrade",
    {
      schema: {
        tags: ["Broker -> Subscription"],
        summary:
          "Start Stripe/GHL checkout to upgrade to a higher plan (Starter→Pro/Elite, Pro→Elite)",
        body: {
          type: "object",
          properties: {
            packageId: { type: "string" },
            packageCode: { type: "string" },
            billingCycle: { type: "string", enum: ["MONTHLY", "YEARLY"] },
            extraUserTotal: { type: "number" },
            addOnCodes: {
              type: "array",
              items: { type: "string" },
            },
            successUrl: { type: "string" },
            cancelUrl: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) {
          return reply.code(400).send({
            success: false,
            message: "Organization missing",
          });
        }

        const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
        if (!roles.includes("BROKER_ADMIN")) {
          return reply.code(403).send({
            success: false,
            code: "FORBIDDEN",
            message: "Only the broker admin can upgrade the plan.",
          });
        }

        const body = req.body || {};
        if (!body.packageId && !body.packageCode) {
          return reply.code(400).send({
            success: false,
            message: "packageId or packageCode is required",
          });
        }

        const result = await startPlanUpgradeCheckout(fastify.prisma, {
          organizationId,
          actorUser: {
            email: req.user?.email,
            firstName: req.user?.firstName,
            lastName: req.user?.lastName,
            name: req.user?.name,
          },
          packageId: body.packageId || undefined,
          packageCode: body.packageCode || undefined,
          billingCycle: body.billingCycle || undefined,
          extraUserTotal:
            body.extraUserTotal != null ? Number(body.extraUserTotal) : 0,
          addOnCodes: Array.isArray(body.addOnCodes) ? body.addOnCodes : [],
          successUrl: body.successUrl || undefined,
          cancelUrl: body.cancelUrl || undefined,
        });

        return reply.send({
          success: true,
          data: result,
        });
      } catch (err) {
        const status = err.statusCode || 500;
        req.log.error(err);
        return reply.code(status).send({
          success: false,
          code: err.code || "PLAN_UPGRADE_FAILED",
          message: err.message || "Failed to start plan upgrade checkout",
        });
      }
    },
  );

  fastify.post(
    "/discontinue",
    {
      schema: {
        tags: ["Broker -> Subscription"],
        summary:
          "Discontinue CLM soft-trial access (stops GHL billing request + locks until subscribe)",
      },
    },
    async (req, reply) => {
      try {
        const organizationId = req.user?.organizationId;
        const actorUserId = req.user?.userId;
        if (!organizationId) {
          return reply.code(400).send({
            success: false,
            message: "Organization missing",
          });
        }

        const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
        if (!roles.includes("BROKER_ADMIN")) {
          return reply.code(403).send({
            success: false,
            code: "FORBIDDEN",
            message: "Only the broker admin can discontinue Loan Automation.",
          });
        }

        const result = await discontinueClmSoftTrial(fastify.prisma, {
          organizationId,
          actorUserId,
        });

        return reply.send({
          success: true,
          data: result,
        });
      } catch (err) {
        const status = err.statusCode || 500;
        req.log.error(err);
        return reply.code(status).send({
          success: false,
          code: err.code || "CLM_DISCONTINUE_FAILED",
          message: err.message || "Failed to discontinue",
        });
      }
    },
  );
}

module.exports = brokerSubscriptionRoutes;
