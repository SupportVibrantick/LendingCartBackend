/**
 * Read-only diagnostic: subscription → Agency GHL location readiness.
 * Does not persist, call GHL APIs, or modify mappings.
 */

const {
  normalizeAccountPlan,
  LOCATION_ENV_BY_PLAN,
} = require("./ghlAccountLocation.service");
const { BROKER_ACCESS_STATUSES } = require("../subscription/subscriptionBilling");

const SETUP_STATUS = Object.freeze({
  READY_FOR_GHL_USER_RECONCILIATION: "READY_FOR_GHL_USER_RECONCILIATION",
  NOT_READY: "NOT_READY",
});

function readConfiguredLocationId(packageCode) {
  const plan = normalizeAccountPlan(packageCode);
  if (!plan) return { plan: null, envKey: null, locationId: null };
  const envKey = LOCATION_ENV_BY_PLAN[plan];
  const locationId =
    process.env[envKey] && String(process.env[envKey]).trim()
      ? String(process.env[envKey]).trim()
      : null;
  return { plan, envKey, locationId };
}

/**
 * @param {object} prisma
 * @param {{ organizationId: string }} args
 */
async function diagnoseOrganizationGhlSetup(prisma, { organizationId } = {}) {
  const orgId = String(organizationId || "").trim();
  const reasons = [];

  if (!orgId) {
    return {
      status: SETUP_STATUS.NOT_READY,
      organization: null,
      subscription: null,
      agencyLocation: null,
      expected: null,
      reasons: ["organizationId is required"],
    };
  }

  const organization = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      type: true,
      isDeleted: true,
    },
  });

  if (!organization || organization.isDeleted) {
    return {
      status: SETUP_STATUS.NOT_READY,
      organization: organization
        ? {
            organizationId: organization.id,
            name: organization.name,
            type: organization.type,
          }
        : null,
      subscription: null,
      agencyLocation: {
        mappingExists: false,
        packageCode: null,
        ghlCompanyId: null,
        ghlLocationId: null,
        status: null,
        assignedAt: null,
      },
      expected: null,
      reasons: ["Organization not found"],
    };
  }

  const orgSafe = {
    organizationId: organization.id,
    name: organization.name,
    type: organization.type,
  };

  const subscription = await prisma.organizationSubscription.findFirst({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    include: {
      package: { select: { id: true, code: true, name: true } },
    },
  });

  const subscriptionSafe = subscription
    ? {
        status: subscription.status,
        packageCode: subscription.package?.code || null,
        packageName: subscription.package?.name || null,
        billingCycle: subscription.billingCycle,
        ghlSubscriptionId: subscription.ghlSubscriptionId || null,
      }
    : null;

  if (!subscription) {
    reasons.push("No organization subscription found");
  } else if (!BROKER_ACCESS_STATUSES.includes(subscription.status)) {
    reasons.push(
      `Subscription status is ${subscription.status} (requires TRIAL or ACTIVE)`,
    );
  }

  const packageCode = subscriptionSafe?.packageCode || null;
  const agencyPlan = normalizeAccountPlan(packageCode);

  if (subscription && !agencyPlan) {
    reasons.push(
      `Package ${packageCode || "(none)"} is not PRO or ELITE — Agency location mapping not applicable`,
    );
  }

  const expected = readConfiguredLocationId(packageCode);

  const mapping = await prisma.organizationGhlAgencyLocation.findUnique({
    where: { organizationId: orgId },
  });

  const agencyLocation = mapping
    ? {
        mappingExists: true,
        packageCode: mapping.packageCode,
        ghlCompanyId: mapping.ghlCompanyId,
        ghlLocationId: mapping.ghlLocationId,
        status: mapping.status,
        assignedAt: mapping.assignedAt,
      }
    : {
        mappingExists: false,
        packageCode: null,
        ghlCompanyId: null,
        ghlLocationId: null,
        status: null,
        assignedAt: null,
      };

  if (!mapping) {
    reasons.push("OrganizationGhlAgencyLocation mapping does not exist");
  } else {
    if (mapping.status !== "ACTIVE") {
      reasons.push(
        `Agency location mapping status is ${mapping.status} (requires ACTIVE)`,
      );
    }
    if (agencyPlan && mapping.packageCode !== agencyPlan) {
      reasons.push(
        `Mapping packageCode ${mapping.packageCode} does not match subscription package ${agencyPlan}`,
      );
    }
    if (!mapping.ghlLocationId || !String(mapping.ghlLocationId).trim()) {
      reasons.push("Mapped ghlLocationId is missing");
    }
  }

  const ready =
    Boolean(organization) &&
    !organization.isDeleted &&
    Boolean(subscription) &&
    BROKER_ACCESS_STATUSES.includes(subscription.status) &&
    Boolean(agencyPlan) &&
    Boolean(mapping) &&
    mapping.status === "ACTIVE" &&
    Boolean(mapping.ghlLocationId) &&
    mapping.packageCode === agencyPlan;

  return {
    status: ready
      ? SETUP_STATUS.READY_FOR_GHL_USER_RECONCILIATION
      : SETUP_STATUS.NOT_READY,
    organization: orgSafe,
    subscription: subscriptionSafe,
    agencyLocation,
    expected: agencyPlan
      ? {
          packageCode: agencyPlan,
          envKey: expected.envKey,
          snapshotEnvKey: expected.envKey
            ? expected.envKey.replace("LOCATION_ID", "SNAPSHOT_ID")
            : null,
          locationId: mapping?.ghlLocationId || null,
          dedicatedLocation: true,
          legacyPoolLocationId: expected.locationId,
        }
      : {
          packageCode: packageCode || null,
          envKey: null,
          snapshotEnvKey: null,
          locationId: null,
          dedicatedLocation: false,
          legacyPoolLocationId: null,
        },
    reasons: ready ? [] : reasons,
  };
}

/**
 * Scan orgs that already have an ACTIVE Agency location mapping (PRO/ELITE)
 * and return those that pass diagnoseOrganizationGhlSetup readiness.
 * Read-only. Does not call GHL APIs.
 *
 * @param {object} prisma
 * @param {{ limit?: number }} [options]
 */
async function findOrganizationsReadyForGhlUserProvisioning(
  prisma,
  { limit = 25 } = {},
) {
  const mappings = await prisma.organizationGhlAgencyLocation.findMany({
    where: {
      status: "ACTIVE",
      packageCode: { in: ["PRO", "ELITE"] },
    },
    select: {
      organizationId: true,
      packageCode: true,
      ghlLocationId: true,
      status: true,
    },
    orderBy: { assignedAt: "desc" },
    take: Math.max(1, Math.min(Number(limit) || 25, 200)),
  });

  const ready = [];
  for (const mapping of mappings) {
    const report = await diagnoseOrganizationGhlSetup(prisma, {
      organizationId: mapping.organizationId,
    });
    if (report.status !== SETUP_STATUS.READY_FOR_GHL_USER_RECONCILIATION) {
      continue;
    }
    ready.push({
      organizationId: report.organization.organizationId,
      organizationName: report.organization.name,
      packageCode: report.subscription.packageCode,
      subscriptionStatus: report.subscription.status,
      ghlLocationId: report.agencyLocation.ghlLocationId,
      mappingStatus: report.agencyLocation.status,
    });
  }

  return {
    readyCount: ready.length,
    candidatesScanned: mappings.length,
    organizations: ready,
  };
}

module.exports = {
  SETUP_STATUS,
  diagnoseOrganizationGhlSetup,
  findOrganizationsReadyForGhlUserProvisioning,
  readConfiguredLocationId,
};
