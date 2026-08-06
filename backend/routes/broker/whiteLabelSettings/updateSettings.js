const LO_BRANDING_VIEW_PERMISSIONS = ["VIEW_COMPANY_SETTINGS", "MANAGE_BRANDING"];
const {
  syncBrokerCompanyAndBrandName,
} = require("../../../services/broker/syncBrokerDisplayName");

async function requireLoanOfficerBrandingView(req, reply, fastify) {
  if (!req.user?.roles?.includes("BROKER_OFFICER")) return;
  await fastify.requirePermission(LO_BRANDING_VIEW_PERMISSIONS)(req, reply);
}

async function requireLoanOfficerBrandingManage(req, reply, fastify) {
  if (!req.user?.roles?.includes("BROKER_OFFICER")) return;
  await fastify.requirePermission("MANAGE_BRANDING")(req, reply);
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
          "Update branding, theme, and white-label configuration for broker. Brand name also updates company name.",
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

      try {
        if (brandName) {
          await syncBrokerCompanyAndBrandName(prisma, brokerOrgId, brandName, {
            userId,
          });
          delete payload.brandName;
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
            sslStatus: "PENDING",
          },
        });

        return reply.send({
          success: true,
          message: "White-label settings updated successfully",
          data: {
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
            updatedAt: settings.updatedAt,
          },
        });
      } catch (err) {
        return reply.code(err.statusCode || 500).send({
          success: false,
          message: err.message || "Failed to update white-label settings",
        });
      }
    },
  );
}

module.exports = updateWhiteLabelSettings;
