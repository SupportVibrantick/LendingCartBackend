const {
  getFeatureCatalog,
  getOrgEnabledFeatures,
} = require("../../services/subscription/brokerOrgFeatures");

/**
 * Shared org entitlements payload for broker / loan-officer / co-broker portals.
 */
async function sendOrgEntitlements(fastify, req, reply) {
  try {
    const orgId = req.user?.organizationId;
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

    let usage = null;
    if (entitlements.subscription) {
      const {
        resolveEffectiveUsageLimits,
        countMetricUsage,
        APPLICATIONS_PER_SEAT_PER_MONTH,
      } = require("../../services/subscription/subscriptionBilling");
      const resolved = resolveEffectiveUsageLimits(entitlements.subscription);
      const { effective } = resolved;
      const [loanOfficersUsed, coBrokersUsed, applicationsUsed] =
        await Promise.all([
          countMetricUsage(fastify.prisma, orgId, "LOAN_OFFICERS"),
          countMetricUsage(fastify.prisma, orgId, "CO_BROKERS"),
          countMetricUsage(fastify.prisma, orgId, "LOAN_APPLICATIONS"),
        ]);
      usage = {
        limits: effective,
        used: {
          LOAN_OFFICERS: loanOfficersUsed,
          CO_BROKERS: coBrokersUsed,
          LOAN_APPLICATIONS: applicationsUsed,
        },
        teamSeats: resolved.teamSeats,
        applicationsPerSeat: APPLICATIONS_PER_SEAT_PER_MONTH,
      };
    }

    return reply.send({
      success: true,
      data: {
        features: entitlements.features,
        permissions: entitlements.permissions,
        loanCategories: entitlements.loanCategories,
        loanTypes: entitlements.loanTypes,
        catalog,
        packageCode: entitlements.subscription?.package?.code || null,
        usage,
      },
    });
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({
      success: false,
      message: "Failed to load entitlements",
    });
  }
}

module.exports = { sendOrgEntitlements };
