const {
  ACTIVE_SUB_STATUSES,
  ADMIN_EDITABLE_USAGE_METRICS,
  USAGE_METRIC_LABELS,
  resolveEffectiveUsageLimits,
  countMetricUsage,
} = require("../../../../services/subscription/subscriptionBilling");
const {
  getFeatureCatalog,
  resolveEnabledFeatures,
  splitFeatures,
  defaultFeaturesForPackage,
} = require("../../../../services/subscription/brokerOrgFeatures");

async function buildOrgUsageLimits(prisma, subscription, orgId) {
  if (!subscription) return null;

  const resolved = resolveEffectiveUsageLimits(subscription);
  const metrics = [];

  for (const metric of ADMIN_EDITABLE_USAGE_METRICS) {
    const row = (subscription.usageRecords || []).find((r) => r.metric === metric);
    const usedValue =
      row?.usedValue ?? (await countMetricUsage(prisma, orgId, metric));
    const packageDefault =
      resolved.packageDefaults?.[metric] != null
        ? Number(resolved.packageDefaults[metric])
        : null;
    const limitValue =
      resolved.effective?.[metric] != null
        ? Number(resolved.effective[metric])
        : row?.limitValue != null
          ? Number(row.limitValue)
          : null;

    metrics.push({
      metric,
      label: USAGE_METRIC_LABELS[metric] || metric,
      usedValue,
      limitValue: Number.isFinite(limitValue) ? limitValue : null,
      packageDefault: Number.isFinite(packageDefault) ? packageDefault : null,
      isCustom: Object.prototype.hasOwnProperty.call(
        resolved.overrides || {},
        metric,
      ),
    });
  }

  return {
    usageLimitOverrides: resolved.overrides,
    packageDefaults: resolved.packageDefaults,
    effective: resolved.effective,
    metrics,
  };
}

async function subscriberDetailRoutes(fastify) {
  fastify.get(
    "/:orgId",
    {
      schema: {
        tags: ["Admin -> Subscriptions"],
        summary: "Get subscriber detail",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const { orgId } = req.params;

      try {
        const org = await prisma.organization.findFirst({
          where: { id: orgId, type: "BROKER" },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            status: true,
            createdAt: true,
          },
        });

        if (!org) {
          return reply.status(404).send({
            success: false,
            message: "Broker organization not found",
          });
        }

        const [subscription, history, featureCatalog] = await Promise.all([
          prisma.organizationSubscription.findFirst({
            where: {
              organizationId: orgId,
              status: { in: ACTIVE_SUB_STATUSES },
            },
            orderBy: { createdAt: "desc" },
            include: {
              package: true,
              usageRecords: {
                orderBy: { metric: "asc" },
              },
              invoices: {
                orderBy: { createdAt: "desc" },
                take: 20,
              },
            },
          }),
          prisma.organizationSubscription.findMany({
            where: { organizationId: orgId },
            orderBy: { createdAt: "desc" },
            take: 10,
            include: {
              package: {
                select: { id: true, name: true, code: true },
              },
            },
          }),
          getFeatureCatalog(prisma),
        ]);

        const isCustom = Array.isArray(subscription?.enabledFeatures)
          ? true
          : Boolean(
              subscription?.enabledFeatures &&
                typeof subscription.enabledFeatures === "object" &&
                Array.isArray(subscription.enabledFeatures.keys),
            );
        const enabledFeatures = resolveEnabledFeatures(subscription);
        const packageDefaults = subscription
          ? defaultFeaturesForPackage(
              subscription.package?.code,
              subscription.purchasedAddOns,
            )
          : [];
        const orgUsageLimits = await buildOrgUsageLimits(
          prisma,
          subscription,
          orgId,
        );

        return reply.send({
          success: true,
          data: {
            organization: org,
            subscription,
            history,
            featureCatalog,
            orgFeatures: {
              enabledFeatures,
              isCustom,
              packageDefaults,
              ...splitFeatures(enabledFeatures),
            },
            orgUsageLimits,
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          success: false,
          message: "Failed to fetch subscriber detail",
        });
      }
    },
  );
}

module.exports = subscriberDetailRoutes;
