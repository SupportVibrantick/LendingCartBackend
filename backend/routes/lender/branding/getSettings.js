/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function getLenderBrandingSettings(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Lender -> Branding"],
        summary: "Get lender branding settings",
        description:
          "Fetch brand name and logo used on LOI / term sheet documents.",
      },
    },
    async (req, reply) => {
      if (!req.user || req.user.orgType !== "LENDER") {
        return reply.code(403).send({
          success: false,
          message: "Lender access only",
        });
      }

      const lenderOrgId = req.user.organizationId;
      const prisma = fastify.prisma;

      let settings = await prisma.lenderBrandingSetting.findFirst({
        where: { lenderOrgId },
      });

      const organization = await prisma.organization.findUnique({
        where: { id: lenderOrgId },
        select: { name: true },
      });

      if (!settings) {
        settings = await prisma.lenderBrandingSetting.create({
          data: {
            lenderOrgId,
            brandName: organization?.name || null,
          },
        });
      } else if (!settings.brandName?.trim() && organization?.name) {
        settings = await prisma.lenderBrandingSetting.update({
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
          brandName: settings.brandName || organization?.name || null,
          logoUrl: settings.logoUrl,
          createdAt: settings.createdAt,
          updatedAt: settings.updatedAt,
        },
      });
    },
  );
}

module.exports = getLenderBrandingSettings;
