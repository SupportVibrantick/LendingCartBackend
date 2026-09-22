const {
  ACTIVE_SUB_STATUSES,
  ADMIN_EDITABLE_USAGE_METRICS,
  USAGE_METRIC_LABELS,
  sanitizeUsageLimitOverrides,
  parseEnabledFeaturesPayload,
  buildEnabledFeaturesPayload,
  resolveEffectiveUsageLimits,
  refreshUsageForSubscription,
  countMetricUsage,
} = require("../../../../services/subscription/subscriptionBilling");
const { resolveEnabledFeatures } = require("../../../../services/subscription/brokerOrgFeatures");

async function updateUsageLimitsRoutes(fastify) {
  fastify.put(
    "/:orgId/usage-limits",
    {
      schema: {
        tags: ["Admin -> Subscriptions"],
        summary: "Update subscriber usage limit overrides",
        body: {
          type: "object",
          properties: {
            limits: {
              type: "object",
              additionalProperties: { type: ["integer", "null", "number"] },
            },
            resetToPackage: { type: "boolean" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const { orgId } = req.params;

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
          include: { package: true },
        });

        if (!subscription) {
          return reply.status(400).send({
            success: false,
            message: "No active subscription found for this broker",
          });
        }

        const resetToPackage = Boolean(req.body?.resetToPackage);
        const parsed = parseEnabledFeaturesPayload(subscription.enabledFeatures);
        const wasCustomFeatures = parsed.keys != null;
        const featureKeys = wasCustomFeatures
          ? parsed.keys
          : resolveEnabledFeatures(subscription);

        let nextLimits = null;
        if (!resetToPackage) {
          const incoming = req.body?.limits || {};
          const cleaned = {};
          for (const metric of ADMIN_EDITABLE_USAGE_METRICS) {
            if (!(metric in incoming)) continue;
            const raw = incoming[metric];
            if (raw === null || raw === "" || raw === undefined) continue;
            const n = Number(raw);
            if (Number.isFinite(n) && Number.isInteger(n) && n >= 0) {
              cleaned[metric] = n;
            }
          }
          nextLimits = sanitizeUsageLimitOverrides(cleaned);
        }

        let payload;
        if (resetToPackage) {
          payload = wasCustomFeatures
            ? buildEnabledFeaturesPayload(featureKeys, null)
            : null;
        } else {
          payload = buildEnabledFeaturesPayload(featureKeys, nextLimits);
        }

        const updated = await prisma.organizationSubscription.update({
          where: { id: subscription.id },
          data: { enabledFeatures: payload },
          include: { package: true },
        });

        const records = await refreshUsageForSubscription(prisma, updated.id);
        const resolved = resolveEffectiveUsageLimits(updated);

        const metrics = [];
        for (const metric of ADMIN_EDITABLE_USAGE_METRICS) {
          const row = records.find((r) => r.metric === metric);
          const usedValue =
            row?.usedValue ?? (await countMetricUsage(prisma, orgId, metric));
          const packageDefault =
            resolved.packageDefaults?.[metric] != null
              ? Number(resolved.packageDefaults[metric])
              : null;
          const limitValue =
            resolved.effective?.[metric] != null
              ? Number(resolved.effective[metric])
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

        return reply.send({
          success: true,
          message: resetToPackage
            ? "Usage limits reset to package defaults"
            : "Usage limits updated",
          data: {
            usageLimitOverrides: nextLimits,
            packageDefaults: resolved.packageDefaults,
            effective: resolved.effective,
            metrics,
            usageRecords: records,
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          success: false,
          message: "Failed to update usage limits",
        });
      }
    },
  );
}

module.exports = updateUsageLimitsRoutes;
