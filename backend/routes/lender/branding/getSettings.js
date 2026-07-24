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

      if (!settings) {
        settings = await prisma.lenderBrandingSetting.create({
          data: { lenderOrgId },
        });
      }

      return reply.send({
        success: true,
        data: {
          id: settings.id,
          brandName: settings.brandName,
          logoUrl: settings.logoUrl,
          createdAt: settings.createdAt,
          updatedAt: settings.updatedAt,
        },
      });
    },
  );
}

module.exports = getLenderBrandingSettings;
