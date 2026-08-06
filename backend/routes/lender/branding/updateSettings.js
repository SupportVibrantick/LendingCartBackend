const {
  syncLenderCompanyAndBrandName,
} = require("../../../services/lender/syncLenderDisplayName");

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
          "Update brand name and logo shown on generated LOI / term sheets. Brand name also updates company name.",
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
      const brandName =
        typeof payload.brandName === "string"
          ? payload.brandName.trim()
          : undefined;
      const logoUrl =
        typeof payload.logoUrl === "string" ? payload.logoUrl : payload.logoUrl;

      try {
        let settings;

        if (brandName) {
          // Keep Organization.name and brandName aligned.
          const synced = await syncLenderCompanyAndBrandName(
            prisma,
            lenderOrgId,
            brandName,
          );
          settings = synced.branding;

          if (logoUrl !== undefined) {
            settings = await prisma.lenderBrandingSetting.update({
              where: { lenderOrgId },
              data: {
                logoUrl,
                updatedAt: new Date(),
              },
            });
          }
        } else {
          settings = await prisma.lenderBrandingSetting.upsert({
            where: { lenderOrgId },
            update: {
              ...(logoUrl !== undefined ? { logoUrl } : {}),
              ...(payload.brandName !== undefined
                ? { brandName: brandName || null }
                : {}),
              updatedAt: new Date(),
            },
            create: {
              lenderOrgId,
              brandName: brandName || null,
              ...(logoUrl !== undefined ? { logoUrl } : {}),
            },
          });
        }

        return reply.send({
          success: true,
          message: "Branding updated successfully",
          data: {
            id: settings.id,
            brandName: settings.brandName,
            logoUrl: settings.logoUrl,
            updatedAt: settings.updatedAt,
            companyName: brandName || settings.brandName,
          },
        });
      } catch (err) {
        return reply.code(err.statusCode || 500).send({
          success: false,
          message: err.message || "Failed to update branding",
        });
      }
    },
  );
}

module.exports = updateLenderBrandingSettings;
