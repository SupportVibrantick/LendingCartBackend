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

      const [settings, organization] = await Promise.all([
        prisma.lenderBrandingSetting.findUnique({
          where: { lenderOrgId },
          select: {
            id: true,
            brandName: true,
            logoUrl: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        prisma.organization.findUnique({
          where: { id: lenderOrgId },
          select: { name: true },
        }),
      ]);

      // Avoid write-on-read for the common case: return org name as fallback.
      if (settings) {
        return reply.send({
          success: true,
          data: {
            id: settings.id,
            brandName: settings.brandName?.trim() || organization?.name || null,
            logoUrl: settings.logoUrl,
            createdAt: settings.createdAt,
            updatedAt: settings.updatedAt,
          },
        });
      }

      const created = await prisma.lenderBrandingSetting.create({
        data: {
          lenderOrgId,
          brandName: organization?.name || null,
        },
        select: {
          id: true,
          brandName: true,
          logoUrl: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return reply.send({
        success: true,
        data: {
          id: created.id,
          brandName: created.brandName || organization?.name || null,
          logoUrl: created.logoUrl,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
        },
      });
    },
  );
}

module.exports = getLenderBrandingSettings;
