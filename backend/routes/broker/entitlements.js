const {
  getFeatureCatalog,
  getOrgEnabledFeatures,
} = require("../../services/subscription/brokerOrgFeatures");

async function entitlementsRoutes(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Broker -> Entitlements"],
        summary: "Get org feature entitlements for the current broker",
      },
    },
    async (req, reply) => {
      try {
        const orgId = req.user.organizationId;
        if (!orgId) {
          return reply.status(400).send({
            success: false,
            message: "Organization missing",
          });
        }

        const [entitlements, catalog] = await Promise.all([
          getOrgEnabledFeatures(fastify.prisma, orgId),
          getFeatureCatalog(fastify.prisma),
        ]);

        return reply.send({
          success: true,
          data: {
            features: entitlements.features,
            permissions: entitlements.permissions,
            loanCategories: entitlements.loanCategories,
            loanTypes: entitlements.loanTypes,
            catalog,
            packageCode: entitlements.subscription?.package?.code || null,
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          success: false,
          message: "Failed to load entitlements",
        });
      }
    },
  );
}

module.exports = entitlementsRoutes;
