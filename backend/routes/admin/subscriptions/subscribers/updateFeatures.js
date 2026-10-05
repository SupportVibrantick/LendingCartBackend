const {
  getFeatureCatalog,
  normalizeFeatureKeys,
  resolveEnabledFeatures,
  splitFeatures,
  defaultFeaturesForPackage,
} = require("../../../../services/subscription/brokerOrgFeatures");
const {
  ACTIVE_SUB_STATUSES,
  parseEnabledFeaturesPayload,
  buildEnabledFeaturesPayload,
} = require("../../../../services/subscription/subscriptionBilling");

async function updateFeaturesRoutes(fastify) {
  fastify.get(
    "/features/catalog",
    {
      schema: {
        tags: ["Admin -> Subscriptions"],
        summary:
          "Broker feature catalog for permission UI (loan type names from loan products)",
      },
    },
    async (_req, reply) => {
      try {
        const catalog = await getFeatureCatalog(fastify.prisma);
        return reply.send({
          success: true,
          data: { catalog },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          success: false,
          message: "Failed to load feature catalog",
        });
      }
    },
  );

  fastify.get(
    "/features/package-defaults",
    {
      schema: {
        tags: ["Admin -> Subscriptions"],
        summary:
          "Preview package default features (optionally merge org add-ons)",
        querystring: {
          type: "object",
          properties: {
            packageId: { type: "string" },
            packageCode: { type: "string" },
            organizationId: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      try {
        const packageId = req.query?.packageId
          ? String(req.query.packageId)
          : "";
        const packageCodeRaw = req.query?.packageCode
          ? String(req.query.packageCode)
          : "";
        const organizationId = req.query?.organizationId
          ? String(req.query.organizationId)
          : "";

        let packageCode = packageCodeRaw.toUpperCase();
        let packageName = null;
        let pkgId = packageId || null;

        if (packageId) {
          const pkg = await prisma.subscriptionPackage.findFirst({
            where: { id: packageId },
            select: { id: true, code: true, name: true },
          });
          if (!pkg) {
            return reply.status(404).send({
              success: false,
              message: "Package not found",
            });
          }
          packageCode = String(pkg.code || "").toUpperCase();
          packageName = pkg.name;
          pkgId = pkg.id;
        } else if (!packageCode) {
          return reply.status(400).send({
            success: false,
            message: "packageId or packageCode is required",
          });
        }

        let purchasedAddOns = [];
        if (organizationId) {
          const sub = await prisma.organizationSubscription.findFirst({
            where: {
              organizationId,
              status: { in: ACTIVE_SUB_STATUSES },
            },
            select: { purchasedAddOns: true },
            orderBy: { createdAt: "desc" },
          });
          purchasedAddOns = Array.isArray(sub?.purchasedAddOns)
            ? sub.purchasedAddOns
            : [];
        }

        const defaults = defaultFeaturesForPackage(
          packageCode,
          purchasedAddOns,
        );

        return reply.send({
          success: true,
          data: {
            packageId: pkgId,
            packageCode,
            packageName,
            defaults,
            ...splitFeatures(defaults),
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          success: false,
          message: "Failed to load package feature defaults",
        });
      }
    },
  );

  fastify.put(
    "/:orgId/features",
    {
      schema: {
        tags: ["Admin -> Subscriptions"],
        summary: "Update broker org enabled features",
        body: {
          type: "object",
          required: ["features"],
          properties: {
            features: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const { orgId } = req.params;
      const features = normalizeFeatureKeys(req.body?.features || []);

      try {
        const org = await prisma.organization.findFirst({
          where: { id: orgId, type: "BROKER" },
          select: { id: true },
        });

        if (!org) {
          return reply.status(404).send({
            success: false,
            message: "Broker organization not found",
          });
        }

        const subscription = await prisma.organizationSubscription.findFirst({
          where: {
            organizationId: orgId,
            status: { in: ACTIVE_SUB_STATUSES },
          },
          orderBy: { createdAt: "desc" },
          include: {
            package: { select: { id: true, code: true, name: true } },
          },
        });

        if (!subscription) {
          return reply.status(400).send({
            success: false,
            message: "No active subscription found for this broker",
          });
        }

        const { usageLimits } = parseEnabledFeaturesPayload(
          subscription.enabledFeatures,
        );
        const enabledFeaturesPayload = buildEnabledFeaturesPayload(
          features,
          usageLimits,
        );

        const updated = await prisma.organizationSubscription.update({
          where: { id: subscription.id },
          data: { enabledFeatures: enabledFeaturesPayload },
          include: {
            package: { select: { id: true, code: true, name: true } },
          },
        });

        const { permissions: allowedPerms } = splitFeatures(features);
        const allowedSet = new Set(allowedPerms);
        const officers = await prisma.userAccount.findMany({
          where: {
            organizationId: orgId,
            roles: { some: { role: { name: "BROKER_OFFICER" } } },
          },
          select: {
            id: true,
            userPermissions: {
              select: {
                id: true,
                permission: { select: { key: true } },
              },
            },
          },
        });

        for (const officer of officers) {
          const revokeIds = officer.userPermissions
            .filter((up) => !allowedSet.has(up.permission.key))
            .map((up) => up.id);
          if (revokeIds.length > 0) {
            await prisma.userPermission.deleteMany({
              where: { id: { in: revokeIds } },
            });
          }
        }

        const resolved = resolveEnabledFeatures(updated);

        return reply.send({
          success: true,
          message: "Features updated",
          data: {
            enabledFeatures: resolved,
            isCustom: true,
            ...splitFeatures(resolved),
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          success: false,
          message: "Failed to update features",
        });
      }
    },
  );
}

module.exports = updateFeaturesRoutes;
