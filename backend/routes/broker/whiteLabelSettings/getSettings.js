/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function getWhiteLabelSettings(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Broker -> White Label"],
        summary: "Get broker white-label settings",
        description: "Fetch white-label and theme settings for the logged-in broker",
      },
    },
    async (req, reply) => {
      //  Authorization check
      if (!req.user || req.user.orgType !== "BROKER") {
        return reply.code(403).send({
          success: false,
          message: "Broker access only",
        });
      }

      const brokerOrgId = req.user.organizationId;
      const prisma = fastify.prisma;

      // Fetch settings
      let settings = await prisma.brokerWhiteLabelSetting.findFirst({
        where: { brokerOrgId },
      });

      // Auto-create defaults if not exists (important for UX)
      if (!settings) {
        settings = await prisma.brokerWhiteLabelSetting.create({
          data: {
            brokerOrgId,
            fullWhiteLabel: false,
            domainVerified: false,
            sslStatus: "PENDING",
          },
        });
      }

      // Return SAFE, dashboard-required fields only
      return reply.send({
        success: true,
        data: {
          id: settings.id,

          // Domain
          platformSubdomain: settings.platformSubdomain,
          customDomain: settings.customDomain,
          domainVerified: settings.domainVerified,
          sslStatus: settings.sslStatus,

          // Branding / Theme
          brandName: settings.brandName,
          logoUrl: settings.logoUrl,
          faviconUrl: settings.faviconUrl,
          primaryColor: settings.primaryColor,
          secondaryColor: settings.secondaryColor,
          fontFamily: settings.fontFamily,

          // UI / Copy
          footerText: settings.footerText,
          supportEmail: settings.supportEmail,

          // Flags
          fullWhiteLabel: settings.fullWhiteLabel,
          showBrokerBrandOnApproval: settings.showBrokerBrandOnApproval,

          createdAt: settings.createdAt,
          updatedAt: settings.updatedAt,
        },
      });
    }
  );
}

module.exports = getWhiteLabelSettings;
