const {
  isGhlOAuthConfigured,
  buildAuthorizationUrl,
  getOrganizationConnection,
  toPublicConnectionStatus,
  disconnectOrganizationConnection,
} = require("../../../../services/ghl/ghlOAuth.service");
const { createOAuthState } = require("../../../../services/ghl/ghlOAuthState");
const {
  requireBrokerAdmin,
  requireBrokerUser,
} = require("./helpers");
const {
  checkRateLimit,
  getClientIp,
} = require("../../../../utils/security/rateLimit");

async function brokerGhlIntegrationRoutes(fastify) {
  fastify.register(require("./contacts"));
  fastify.register(require("./websites"), { prefix: "/websites" });

  fastify.get(
    "/funnels",
    {
      schema: {
        tags: ["Broker -> Integrations -> GHL"],
        summary: "List GoHighLevel funnels for the connected broker location",
      },
    },
    async (req, reply) => {
      if (!requireBrokerUser(req, reply)) return;

      const organizationId = req.user.organizationId;
      try {
        const { listWebsites } = require("../../../../services/ghl/brokerGhlWebsites.service");
        const result = await listWebsites(fastify.prisma, organizationId);
        return reply.send({ success: true, data: result.websites });
      } catch (err) {
        req.log.error(err, "Broker GHL list funnels failed");
        const { toBrokerGhlErrorResponse } = require("../../../../services/ghl/brokerGhlErrors");
        const { statusCode, body } = toBrokerGhlErrorResponse(err);
        return reply.code(statusCode).send(body);
      }
    },
  );
  fastify.get(
    "/connect",
    {
      schema: {
        tags: ["Broker -> Integrations -> GHL"],
        summary: "Start GoHighLevel OAuth connection for this broker organization",
      },
    },
    async (req, reply) => {
      if (!requireBrokerAdmin(req, reply)) return;

      if (!isGhlOAuthConfigured()) {
        return reply.code(503).send({
          success: false,
          code: "GHL_OAUTH_NOT_CONFIGURED",
          message: "GoHighLevel OAuth is not configured on this server",
        });
      }

      const organizationId = req.user.organizationId;
      const userId = req.user.userId || req.user.id;
      const ip = getClientIp(req);
      const limit = checkRateLimit(`ghl-oauth-connect:org:${organizationId}`, {
        windowMs: 15 * 60 * 1000,
        max: 10,
      });
      if (!limit.allowed) {
        return reply.code(429).send({
          success: false,
          message: "Too many connect attempts. Please try again later.",
          retryAfterSec: limit.retryAfterSec,
        });
      }

      const { state } = createOAuthState({ organizationId, userId });
      const authorizationUrl = buildAuthorizationUrl(state);

      req.log.info(
        { organizationId, userId, ip },
        "Broker GHL OAuth connect initiated",
      );

      return reply.send({
        success: true,
        data: {
          authorizationUrl,
          expiresInSec: 15 * 60,
        },
      });
    },
  );

  fastify.get(
    "/status",
    {
      schema: {
        tags: ["Broker -> Integrations -> GHL"],
        summary: "Get GoHighLevel connection status for this broker organization",
      },
    },
    async (req, reply) => {
      if (!requireBrokerUser(req, reply)) return;

      const organizationId = req.user.organizationId;
      const connection = await getOrganizationConnection(
        fastify.prisma,
        organizationId,
      );
      const {
        getPublicAgencyLocationForOrganization,
      } = require("../../../../services/ghl/organizationGhlAgencyLocation.service");
      const agencyLocation = await getPublicAgencyLocationForOrganization(
        fastify.prisma,
        organizationId,
        { roles: req.user.roles || [] },
      );

      return reply.send({
        success: true,
        data: {
          ...toPublicConnectionStatus(connection),
          agencyLocation,
        },
      });
    },
  );

  /**
   * Retry Agency CRM sub-account create/sync after Pro/Elite purchase.
   * Used by broker dashboard "Refresh status" when mapping is still pending.
   */
  fastify.post(
    "/agency/sync",
    {
      schema: {
        tags: ["Broker -> Integrations -> GHL"],
        summary: "Sync / create dedicated Agency CRM location for this organization",
      },
    },
    async (req, reply) => {
      if (!requireBrokerAdmin(req, reply)) return;

      const organizationId = req.user.organizationId;
      const ip = getClientIp(req);
      const limit = checkRateLimit(`ghl-agency-sync:org:${organizationId}`, {
        windowMs: 60 * 1000,
        max: 5,
      });
      if (!limit.allowed) {
        return reply.code(429).send({
          success: false,
          message: "Too many sync attempts. Please wait a moment.",
          retryAfterSec: limit.retryAfterSec,
        });
      }

      const sub = await fastify.prisma.organizationSubscription.findFirst({
        where: {
          organizationId,
          status: { in: ["TRIAL", "ACTIVE", "PAST_DUE"] },
        },
        orderBy: { createdAt: "desc" },
        include: { package: { select: { code: true } } },
      });

      if (!sub) {
        return reply.code(409).send({
          success: false,
          code: "NO_ACTIVE_SUBSCRIPTION",
          message: "An active Pro or Elite subscription is required for CRM setup.",
        });
      }

      const packageCode = String(sub.package?.code || "").toUpperCase();
      if (!["PRO", "ELITE"].includes(packageCode)) {
        return reply.code(409).send({
          success: false,
          code: "PACKAGE_NOT_ELIGIBLE",
          message: "CRM sub-accounts are included with Pro and Elite plans only.",
        });
      }

      const {
        syncAgencyLocationForSubscription,
        getPublicAgencyLocationForOrganization,
      } = require("../../../../services/ghl/organizationGhlAgencyLocation.service");

      const syncResult = await syncAgencyLocationForSubscription(
        fastify.prisma,
        {
          organizationId,
          organizationSubscriptionId: sub.id,
          packageCode,
        },
        { throwOnError: false, provisionUsers: true },
      );

      const agencyLocation = await getPublicAgencyLocationForOrganization(
        fastify.prisma,
        organizationId,
        { roles: req.user.roles || [] },
      );

      req.log.info(
        {
          organizationId,
          ip,
          ok: syncResult.ok,
          action: syncResult.action,
          code: syncResult.code || null,
        },
        "Broker Agency CRM sync requested",
      );

      if (!syncResult.ok || !agencyLocation?.provisioned) {
        return reply.code(502).send({
          success: false,
          code: syncResult.code || "AGENCY_LOCATION_SYNC_FAILED",
          message:
            syncResult.message ||
            "CRM setup is still pending. Please try again shortly or contact support.",
          data: { agencyLocation },
        });
      }

      return reply.send({
        success: true,
        message: "CRM sub-account is ready",
        data: {
          agencyLocation,
          action: syncResult.action,
          usersProvisioned: syncResult.userProvisioning?.eligibleCount ?? null,
        },
      });
    },
  );

  fastify.delete(
    "/disconnect",
    {
      schema: {
        tags: ["Broker -> Integrations -> GHL"],
        summary: "Disconnect GoHighLevel OAuth for this broker organization",
      },
    },
    async (req, reply) => {
      if (!requireBrokerAdmin(req, reply)) return;

      try {
        const result = await disconnectOrganizationConnection(
          fastify.prisma,
          req.user.organizationId,
        );

        return reply.send({
          success: true,
          message: result.existed
            ? "GoHighLevel connection removed"
            : "No GoHighLevel connection was active",
          data: {
            disconnected: result.disconnected,
            ghlLocationId: result.ghlLocationId || null,
          },
        });
      } catch (err) {
        req.log.error(err, "Broker GHL disconnect failed");
        return reply.code(500).send({
          success: false,
          message: "Failed to disconnect GoHighLevel",
        });
      }
    },
  );
}

module.exports = brokerGhlIntegrationRoutes;
