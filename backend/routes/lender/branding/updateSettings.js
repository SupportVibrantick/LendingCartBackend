/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function updateLenderBrandingSettings(fastify) {
  fastify.put(
    "/",
    {
      schema: {
        tags: ["Lender -> Branding"],
        summary: "Update lender branding settings",
        description:
          "Update brand name and logo shown on generated LOI / term sheets.",
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            brandName: { type: "string" },
            logoUrl: { type: "string" },
          },
        },
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
      const payload = req.body || {};

      const settings = await prisma.lenderBrandingSetting.upsert({
        where: { lenderOrgId },
        update: {
          ...payload,
          updatedAt: new Date(),
        },
        create: {
          lenderOrgId,
          ...payload,
        },
      });

      return reply.send({
        success: true,
        message: "Branding updated successfully",
        data: {
          id: settings.id,
          brandName: settings.brandName,
          logoUrl: settings.logoUrl,
          updatedAt: settings.updatedAt,
        },
      });
    },
  );
}

module.exports = updateLenderBrandingSettings;
