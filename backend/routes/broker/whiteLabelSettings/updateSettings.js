/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function updateWhiteLabelSettings(fastify) {
  fastify.put(
    "/",
    {
      schema: {
        tags: ["Broker -> White Label"],
        summary: "Update broker white-label settings",
        description: "Update branding, theme, and white-label configuration for broker",
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            // DOMAIN
            platformSubdomain: { type: "string" },
            customDomain: { type: "string" },

            // BRANDING / THEME
            brandName: { type: "string" },
            logoUrl: { type: "string" },
            faviconUrl: { type: "string" },
            primaryColor: { type: "string" },
            secondaryColor: { type: "string" },
            fontFamily: { type: "string" },

            // UI / COPY
            footerText: { type: "string" },
            supportEmail: { type: "string" },

            // FLAGS
            fullWhiteLabel: { type: "boolean" },
            showBrokerBrandOnApproval: { type: "boolean" },
          },
        },
      },
    },
    async (req, reply) => {
      // 1️⃣ Authorization
      if (!req.user || req.user.orgType !== "BROKER") {
        return reply.code(403).send({
          success: false,
          message: "Broker access only",
        });
      }

      const brokerOrgId = req.user.organizationId;
      const prisma = fastify.prisma;
      const payload = req.body || {};

      // 2️⃣ Protect restricted fields
      delete payload.domainVerified;
      delete payload.sslStatus;

      // 3️⃣ Ensure record exists (upsert)
      const settings = await prisma.brokerWhiteLabelSetting.upsert({
        where: { brokerOrgId },
        update: {
          ...payload,
          updatedAt: new Date(),
        },
        create: {
          brokerOrgId,
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

          updatedAt: settings.updatedAt,
        },
      });
    }
  );
}

module.exports = updateWhiteLabelSettings;
