const {
  syncBrokerCompanyAndBrandName,
} = require("../../../services/broker/syncBrokerDisplayName");
const {
  normalizeCustomDomain,
  getDnsInstructions,
  buildCustomDomainBaseUrl,
} = require("../../../services/broker/customDomain.service");
const {
  forgetHostname,
  rememberHostname,
} = require("../../../services/broker/verifiedCustomDomainCache");

async function requireLoanOfficerBrandingManage(req, reply, fastify) {
  if (!req.user?.roles?.includes("BROKER_OFFICER")) return;
  await fastify.requirePermission("MANAGE_BRANDING")(req, reply);
}

function serializeSettings(settings, brokerOrgId) {
  const publicBaseUrl =
    settings.customDomain && settings.domainVerified
      ? buildCustomDomainBaseUrl(settings.customDomain)
      : null;

  return {
    id: settings.id,
    platformSubdomain: settings.platformSubdomain,
    customDomain: settings.customDomain,
    domainVerified: settings.domainVerified,
    sslStatus: settings.sslStatus,
    brandName: settings.brandName,
    logoUrl: settings.logoUrl,
    faviconUrl: settings.faviconUrl,
    primaryColor: settings.primaryColor,
    secondaryColor: settings.secondaryColor,
    fontFamily: settings.fontFamily,
    footerText: settings.footerText,
    supportEmail: settings.supportEmail,
    fullWhiteLabel: settings.fullWhiteLabel,
    showBrokerBrandOnApproval: settings.showBrokerBrandOnApproval,
    companyName: settings.brandName,
    publicBaseUrl,
    dnsInstructions: getDnsInstructions(settings.customDomain, brokerOrgId),
    updatedAt: settings.updatedAt,
  };
}

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function updateWhiteLabelSettings(fastify) {
  fastify.put(
    "/",
    {
      preHandler: async (req, reply) => {
        await requireLoanOfficerBrandingManage(req, reply, fastify);
      },
      schema: {
        tags: ["Broker -> White Label"],
        summary: "Update broker white-label settings",
        description:
          "Update branding, theme, custom domain, and white-label configuration for broker. Brand name also updates company name.",
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            platformSubdomain: { type: "string" },
            customDomain: { type: "string" },
            brandName: { type: "string" },
            logoUrl: { type: "string" },
            faviconUrl: { type: "string" },
            primaryColor: { type: "string" },
            secondaryColor: { type: "string" },
            fontFamily: { type: "string" },
            footerText: { type: "string" },
            supportEmail: { type: "string" },
            fullWhiteLabel: { type: "boolean" },
            showBrokerBrandOnApproval: { type: "boolean" },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user || req.user.orgType !== "BROKER") {
        return reply.code(403).send({
          success: false,
          message: "Broker access only",
        });
      }

      const brokerOrgId = req.user.organizationId;
      const userId = req.user.userId || req.user.id;
      const prisma = fastify.prisma;
      const payload = { ...(req.body || {}) };

      delete payload.domainVerified;
      delete payload.sslStatus;

      const brandName =
        typeof payload.brandName === "string"
          ? payload.brandName.trim()
          : undefined;

      const hasCustomDomainField = Object.prototype.hasOwnProperty.call(
        payload,
        "customDomain",
      );

      let nextCustomDomain;
      if (hasCustomDomainField) {
        try {
          nextCustomDomain = normalizeCustomDomain(payload.customDomain);
        } catch (err) {
          return reply.code(err.statusCode || 400).send({
            success: false,
            message: err.message,
          });
        }
        payload.customDomain = nextCustomDomain;
      }

      try {
        const existing = await prisma.brokerWhiteLabelSetting.findFirst({
          where: { brokerOrgId },
          select: {
            id: true,
            customDomain: true,
            domainVerified: true,
            sslStatus: true,
          },
        });

        if (brandName) {
          await syncBrokerCompanyAndBrandName(prisma, brokerOrgId, brandName, {
            userId,
          });
          delete payload.brandName;
        }

        if (hasCustomDomainField) {
          const prev = existing?.customDomain || null;
          if (prev !== nextCustomDomain) {
            payload.domainVerified = false;
            payload.sslStatus = nextCustomDomain ? "PENDING" : null;
            if (prev) forgetHostname(prev);
          } else if (nextCustomDomain == null) {
            payload.domainVerified = false;
            payload.sslStatus = null;
            if (prev) forgetHostname(prev);
          }
        }

        const settings = await prisma.brokerWhiteLabelSetting.upsert({
          where: { brokerOrgId },
          update: {
            ...payload,
            updatedAt: new Date(),
          },
          create: {
            brokerOrgId,
            ...(brandName ? { brandName } : {}),
            ...payload,
            domainVerified: false,
            sslStatus: payload.customDomain ? "PENDING" : "PENDING",
          },
        });

        if (settings.domainVerified && settings.customDomain) {
          rememberHostname(settings.customDomain);
        }

        return reply.send({
          success: true,
          message: "White-label settings updated successfully",
          data: serializeSettings(settings, brokerOrgId),
        });
      } catch (err) {
        if (err?.code === "P2002") {
          return reply.code(409).send({
            success: false,
            message:
              "That domain is already connected to another brokerage. Choose a different hostname.",
          });
        }
        return reply.code(err.statusCode || 500).send({
          success: false,
          message: err.message || "Failed to update white-label settings",
        });
      }
    },
  );
}

module.exports = updateWhiteLabelSettings;
