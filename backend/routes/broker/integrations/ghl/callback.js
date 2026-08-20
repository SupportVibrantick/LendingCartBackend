const {
  isGhlOAuthConfigured,
  exchangeAuthorizationCode,
  saveOrganizationConnection,
  GhlOAuthError,
} = require("../../../../services/ghl/ghlOAuth.service");
const { verifyOAuthState } = require("../../../../services/ghl/ghlOAuthState");
const {
  buildBrokerIntegrationRedirect,
} = require("./helpers");
const {
  checkRateLimit,
  getClientIp,
} = require("../../../../utils/security/rateLimit");

async function brokerGhlOAuthCallbackRoute(fastify) {
  fastify.get(
    "/callback",
    {
      schema: {
        tags: ["Broker -> Integrations -> GHL"],
        summary: "GoHighLevel OAuth callback (public redirect target)",
      },
    },
    async (req, reply) => {
      const ip = getClientIp(req);
      const limit = checkRateLimit(`ghl-oauth-callback:ip:${ip}`, {
        windowMs: 60 * 1000,
        max: 30,
      });
      if (!limit.allowed) {
        return reply.code(429).send({
          success: false,
          message: "Too many OAuth callback requests",
        });
      }

      const { code, state, error, error_description: errorDescription } =
        req.query || {};

      const redirectOnError = (codeKey, message) => {
        const redirectUrl = buildBrokerIntegrationRedirect({
          success: false,
          code: codeKey,
          message,
        });
        if (redirectUrl) {
          return reply.redirect(redirectUrl);
        }
        return reply.code(400).send({
          success: false,
          code: codeKey,
          message,
        });
      };

      if (error) {
        return redirectOnError(
          "oauth_denied",
          errorDescription || error || "GoHighLevel authorization was denied",
        );
      }

      if (!isGhlOAuthConfigured()) {
        return redirectOnError(
          "oauth_not_configured",
          "GoHighLevel OAuth is not configured on this server",
        );
      }

      const stateResult = verifyOAuthState(state);
      if (!stateResult.ok) {
        return redirectOnError(
          "invalid_state",
          "OAuth state is invalid or expired. Please start connect again.",
        );
      }

      if (!code) {
        return redirectOnError(
          "missing_code",
          "Authorization code was not returned by GoHighLevel",
        );
      }

      try {
        const tokenPayload = await exchangeAuthorizationCode(code);
        await saveOrganizationConnection(fastify.prisma, {
          organizationId: stateResult.organizationId,
          connectedByUserId: stateResult.userId,
          tokenPayload,
        });

        req.log.info(
          {
            organizationId: stateResult.organizationId,
            userId: stateResult.userId,
            ghlLocationId: tokenPayload.locationId,
          },
          "Broker GHL OAuth connected",
        );

        const redirectUrl = buildBrokerIntegrationRedirect({
          success: true,
        });
        if (redirectUrl) {
          return reply.redirect(redirectUrl);
        }

        return reply.send({
          success: true,
          message: "GoHighLevel connected successfully",
          data: {
            ghlLocationId: tokenPayload.locationId,
            ghlCompanyId: tokenPayload.companyId || null,
          },
        });
      } catch (err) {
        req.log.error(err, "Broker GHL OAuth callback failed");

        if (err instanceof GhlOAuthError) {
          return redirectOnError(err.code || "oauth_failed", err.message);
        }

        return redirectOnError(
          "oauth_failed",
          "Failed to complete GoHighLevel connection",
        );
      }
    },
  );
}

module.exports = brokerGhlOAuthCallbackRoute;
