/**
 * Organization → dedicated Agency GHL sub-account mapping.
 *
 * One broker organization = one GHL location (never shared Pro/Elite pools).
 * Creates via Agency Private Integration POST /locations/ when needed.
 * Separate from OrganizationGhlConnection (broker OAuth).
 */

const {
  normalizeAccountPlan,
  getAgencyCompanyId,
  getOptionalSnapshotIdForPlan,
  isSharedPoolLocationId,
  buildAgencyLocationDashboardUrl,
  buildAgencyAppLoginUrl,
  GhlAccountLocationError,
} = require("./ghlAccountLocation.service");
const { createAgencyLocation } = require("./ghlAgencyLocationCreate.service");
const { commonLogs } = require("../logger/contextLogger");

function assertOrganizationId(organizationId) {
  if (!organizationId || !String(organizationId).trim()) {
    throw new GhlAccountLocationError("organizationId is required for Agency location mapping", {
      code: "MISSING_ORGANIZATION_ID",
      statusCode: 400,
    });
  }
  return String(organizationId).trim();
}

function hasDedicatedLocationId(mapping) {
  const id = mapping?.ghlLocationId && String(mapping.ghlLocationId).trim();
  if (!id) return false;
  return !isSharedPoolLocationId(id);
}

async function loadOrganizationProfile(prisma, organizationId) {
  if (typeof prisma?.organization?.findUnique !== "function") {
    return { name: null, phone: null, email: null, firstName: null, lastName: null };
  }
  try {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, phone: true, email: true },
    });

    let firstName = null;
    let lastName = null;
    if (typeof prisma?.userAccount?.findFirst === "function") {
      const admin = await prisma.userAccount.findFirst({
        where: {
          organizationId,
          status: "ACTIVE",
          roles: { some: { role: { name: "BROKER_ADMIN" } } },
        },
        orderBy: { createdAt: "asc" },
        select: { firstName: true, lastName: true, email: true },
      });
      firstName = admin?.firstName || null;
      lastName = admin?.lastName || null;
    }

    return {
      name: org?.name || null,
      phone: org?.phone || null,
      email: org?.email || null,
      firstName,
      lastName,
    };
  } catch {
    return { name: null, phone: null, email: null, firstName: null, lastName: null };
  }
}

function isSubBrokerWithoutCompanyGhl(roles) {
  const list = Array.isArray(roles) ? roles.map((r) => String(r).toUpperCase()) : [];
  if (!list.includes("SUB_BROKER")) return false;
  return !list.includes("BROKER_ADMIN") && !list.includes("BROKER_OFFICER");
}

/**
 * Safe public Agency CRM status for broker dashboard (no tokens).
 * Co-Brokers / Sub-Brokers never receive this payload.
 */
async function getPublicAgencyLocationForOrganization(
  prisma,
  organizationId,
  { roles = [] } = {},
) {
  if (isSubBrokerWithoutCompanyGhl(roles)) return null;
  const orgId = String(organizationId || "").trim();
  if (!orgId || typeof prisma?.organizationGhlAgencyLocation?.findUnique !== "function") {
    return null;
  }

  const mapping = await prisma.organizationGhlAgencyLocation.findUnique({
    where: { organizationId: orgId },
  });
  if (!mapping || mapping.status !== "ACTIVE" || !mapping.ghlLocationId) {
    return {
      provisioned: false,
      status: mapping?.status || "NONE",
      packageCode: mapping?.packageCode || null,
      ghlLocationId: null,
      dashboardUrl: null,
      assignedAt: mapping?.assignedAt || null,
      loginUrl: buildAgencyAppLoginUrl(),
    };
  }

  return {
    provisioned: true,
    status: mapping.status,
    packageCode: mapping.packageCode,
    ghlLocationId: mapping.ghlLocationId,
    dashboardUrl: buildAgencyLocationDashboardUrl(mapping.ghlLocationId),
    assignedAt: mapping.assignedAt,
    loginUrl: buildAgencyAppLoginUrl(),
  };
}

async function persistMapping(prisma, { organizationId, packageCode, ghlCompanyId, ghlLocationId, assignedAt }) {
  const now = assignedAt || new Date();
  return prisma.organizationGhlAgencyLocation.upsert({
    where: { organizationId },
    create: {
      organizationId,
      packageCode,
      ghlCompanyId,
      ghlLocationId,
      status: "ACTIVE",
      assignedAt: now,
      lastError: null,
    },
    update: {
      packageCode,
      ghlCompanyId,
      ghlLocationId,
      status: "ACTIVE",
      assignedAt: now,
      lastError: null,
    },
  });
}

async function deactivateMapping(prisma, existing) {
  if (!existing) {
    return {
      action: "noop",
      mapping: null,
    };
  }
  if (existing.status === "INACTIVE") {
    return {
      action: "already_inactive",
      mapping: existing,
    };
  }
  const mapping = await prisma.organizationGhlAgencyLocation.update({
    where: { organizationId: existing.organizationId },
    data: {
      status: "INACTIVE",
      lastError: null,
    },
  });
  return {
    action: "deactivated",
    mapping,
  };
}

/**
 * Upsert ACTIVE dedicated mapping for PRO/ELITE, or deactivate for BASIC.
 * Idempotent: never creates a second location for an org that already has one.
 *
 * @returns {Promise<{ action: string, mapping: object|null, packageCode: string|null }>}
 */
async function syncOrganizationAgencyLocation(
  prisma,
  { organizationId, packageCode },
  { createLocationFn = null } = {},
) {
  const orgId = assertOrganizationId(organizationId);
  const rawCode = String(packageCode || "").trim().toUpperCase();
  const agencyPlan = normalizeAccountPlan(rawCode);

  const existing = await prisma.organizationGhlAgencyLocation.findUnique({
    where: { organizationId: orgId },
  });

  // BASIC (and any non-PRO/ELITE) → deactivate mapping; never delete the GHL location.
  if (!agencyPlan) {
    const deactivated = await deactivateMapping(prisma, existing);
    return {
      ...deactivated,
      packageCode: existing?.packageCode || rawCode || null,
    };
  }

  const companyId = getAgencyCompanyId();

  // Reuse a dedicated location (including INACTIVE → reactivate, PRO ↔ ELITE keep same CRM).
  if (hasDedicatedLocationId(existing)) {
    if (
      existing.status === "ACTIVE" &&
      existing.packageCode === agencyPlan &&
      existing.ghlCompanyId === companyId
    ) {
      return {
        action: "unchanged",
        mapping: existing,
        packageCode: agencyPlan,
      };
    }

    const mapping = await persistMapping(prisma, {
      organizationId: orgId,
      packageCode: agencyPlan,
      ghlCompanyId: companyId,
      ghlLocationId: existing.ghlLocationId,
      assignedAt:
        existing.status === "ACTIVE" && existing.packageCode === agencyPlan
          ? existing.assignedAt
          : new Date(),
    });

    return {
      action: existing.status === "INACTIVE" ? "reactivated" : "updated",
      mapping,
      packageCode: agencyPlan,
    };
  }

  const profile = await loadOrganizationProfile(prisma, orgId);
  const locationName = String(profile.name || "Broker Organization").trim() || "Broker Organization";
  const { snapshotId } = getOptionalSnapshotIdForPlan(agencyPlan);
  const createFn = createLocationFn || createAgencyLocation;

  const created = await createFn({
    name: locationName,
    companyId,
    snapshotId,
    phone: profile.phone,
    email: profile.email,
    firstName: profile.firstName,
    lastName: profile.lastName,
  });

  const locationId = created?.locationId && String(created.locationId).trim();
  if (!locationId) {
    throw new GhlAccountLocationError(
      "Agency location create returned no locationId",
      { code: "AGENCY_LOCATION_CREATE_NO_ID", statusCode: 502 },
    );
  }

  const mapping = await persistMapping(prisma, {
    organizationId: orgId,
    packageCode: agencyPlan,
    ghlCompanyId: created.companyId || companyId,
    ghlLocationId: locationId,
    assignedAt: new Date(),
  });

  return {
    action: "created",
    mapping,
    packageCode: agencyPlan,
  };
}

async function provisionUsersAfterLocationSync(prisma, { organizationId, mapping }) {
  if (!mapping || mapping.status !== "ACTIVE") {
    return { skipped: true, reason: "mapping_not_active" };
  }
  if (typeof prisma?.userAccount?.findMany !== "function") {
    return { skipped: true, reason: "user_lookup_unavailable" };
  }

  try {
    const {
      provisionEligibleOrganizationGhlAgencyUsers,
    } = require("./ghlAgencyUserProvisioning.service");
    return await provisionEligibleOrganizationGhlAgencyUsers(prisma, {
      organizationId,
    });
  } catch (err) {
    const message = String(err?.message || "Agency user provisioning failed")
      .slice(0, 500)
      .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
      .replace(/GHL_AGENCY_PRIVATE_TOKEN\s*=\s*\S+/gi, "GHL_AGENCY_PRIVATE_TOKEN=[REDACTED]")
      .replace(/\bpit-[A-Za-z0-9]+\b/gi, "[REDACTED]");
    try {
      commonLogs.error("ghl.agency_user.provision_batch_failed", {
        organizationId,
        message,
      });
    } catch {
      // never throw from logging
    }
    return {
      skipped: false,
      ok: false,
      reason: message,
    };
  }
}

/**
 * Resolve org from subscription and sync Agency location, then provision eligible users.
 * Safe wrapper: logs failures; never throws to callers that treat mapping as best-effort.
 */
async function syncAgencyLocationForSubscription(
  prisma,
  { organizationId, organizationSubscriptionId, packageCode },
  { throwOnError = false, provisionUsers = true } = {},
) {
  let orgId = organizationId ? String(organizationId).trim() : null;
  let code = packageCode != null ? String(packageCode).trim() : null;

  try {
    if ((!orgId || !code) && organizationSubscriptionId) {
      const sub = await prisma.organizationSubscription.findUnique({
        where: { id: organizationSubscriptionId },
        include: { package: { select: { code: true } } },
      });
      if (!sub) {
        throw new GhlAccountLocationError(
          "Organization subscription not found for Agency location sync",
          { code: "SUBSCRIPTION_NOT_FOUND", statusCode: 404 },
        );
      }
      orgId = orgId || sub.organizationId;
      code = code || sub.package?.code || null;
    }

    if (!orgId) {
      throw new GhlAccountLocationError(
        "organizationId is required for Agency location sync",
        { code: "MISSING_ORGANIZATION_ID", statusCode: 400 },
      );
    }

    const result = await syncOrganizationAgencyLocation(prisma, {
      organizationId: orgId,
      packageCode: code,
    });

    let userProvisioning = null;
    if (provisionUsers && result.mapping?.status === "ACTIVE") {
      userProvisioning = await provisionUsersAfterLocationSync(prisma, {
        organizationId: orgId,
        mapping: result.mapping,
      });
    }

    commonLogs.info("ghl.agency_location.synced", {
      organizationId: orgId,
      organizationSubscriptionId: organizationSubscriptionId || null,
      packageCode: result.packageCode,
      action: result.action,
      ghlLocationId: result.mapping?.ghlLocationId || null,
      status: result.mapping?.status || null,
      usersProvisioned: userProvisioning?.eligibleCount ?? null,
    });

    return { ok: true, ...result, userProvisioning };
  } catch (err) {
    const safeMessage = String(err.message || "Agency location sync failed")
      .slice(0, 500)
      .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
      .replace(/GHL_AGENCY_PRIVATE_TOKEN\s*=\s*\S+/gi, "GHL_AGENCY_PRIVATE_TOKEN=[REDACTED]")
      .replace(/\bpit-[A-Za-z0-9]+\b/gi, "[REDACTED]");
    const codeName = err.code || "AGENCY_LOCATION_SYNC_FAILED";

    commonLogs.error("ghl.agency_location.sync_failed", {
      organizationId: orgId || null,
      organizationSubscriptionId: organizationSubscriptionId || null,
      packageCode: code || null,
      code: codeName,
      message: safeMessage,
    });

    if (orgId && prisma?.organizationGhlAgencyLocation?.updateMany) {
      try {
        await prisma.organizationGhlAgencyLocation.updateMany({
          where: { organizationId: orgId },
          data: { lastError: safeMessage.slice(0, 1000) },
        });
      } catch {
        // ignore secondary persistence errors
      }
    }

    if (throwOnError) throw err;
    return {
      ok: false,
      action: "error",
      mapping: null,
      packageCode: code || null,
      code: codeName,
      message: safeMessage,
      userProvisioning: null,
    };
  }
}

module.exports = {
  syncOrganizationAgencyLocation,
  syncAgencyLocationForSubscription,
  hasDedicatedLocationId,
  getPublicAgencyLocationForOrganization,
};
