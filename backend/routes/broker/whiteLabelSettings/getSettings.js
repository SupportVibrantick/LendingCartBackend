const LO_BRANDING_VIEW_PERMISSIONS = ["VIEW_COMPANY_SETTINGS", "MANAGE_BRANDING"];

async function requireLoanOfficerBrandingView(req, reply, fastify) {
  if (!req.user?.roles?.includes("BROKER_OFFICER")) return;
  await fastify.requirePermission(LO_BRANDING_VIEW_PERMISSIONS)(req, reply);
}

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function getWhiteLabelSettings(fastify) {
  fastify.get(
    "/",
    {
      preHandler: async (req, reply) => {
        await requireLoanOfficerBrandingView(req, reply, fastify);
      },
      schema: {
        tags: ["Broker -> White Label"],
        summary: "Get broker white-label settings",
        description: "Fetch white-label and theme settings for the logged-in broker",
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
      const prisma = fastify.prisma;

      let settings = await prisma.brokerWhiteLabelSetting.findFirst({
        where: { brokerOrgId },
      });

      const organization = await prisma.organization.findUnique({
        where: { id: brokerOrgId },
        select: { name: true },
      });

      if (!settings) {
        settings = await prisma.brokerWhiteLabelSetting.create({
          data: {
            brokerOrgId,
            brandName: organization?.name || null,
            fullWhiteLabel: false,
            domainVerified: false,
            sslStatus: "PENDING",
          },
        });
      } else if (!settings.brandName?.trim() && organization?.name) {
        settings = await prisma.brokerWhiteLabelSetting.update({
          where: { id: settings.id },
          data: {
            brandName: organization.name,
            updatedAt: new Date(),
          },
        });
      }

      return reply.send({
        success: true,
        data: {
          id: settings.id,
          platformSubdomain: settings.platformSubdomain,
          customDomain: settings.customDomain,
          domainVerified: settings.domainVerified,
          sslStatus: settings.sslStatus,
          brandName: settings.brandName || organization?.name || null,
          logoUrl: settings.logoUrl,
          faviconUrl: settings.faviconUrl,
          primaryColor: settings.primaryColor,
          secondaryColor: settings.secondaryColor,
          fontFamily: settings.fontFamily,
          footerText: settings.footerText,
          supportEmail: settings.supportEmail,
          fullWhiteLabel: settings.fullWhiteLabel,
          showBrokerBrandOnApproval: settings.showBrokerBrandOnApproval,
          createdAt: settings.createdAt,
          updatedAt: settings.updatedAt,
        },
      });
    },
  );
}

module.exports = getWhiteLabelSettings;
