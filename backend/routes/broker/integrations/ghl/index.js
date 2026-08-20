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

      return reply.send({
        success: true,
        data: toPublicConnectionStatus(connection),
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
