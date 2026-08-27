/**
 * Read-only Agency GHL team-user listing + LendingCart reconciliation.
 *
 * Uses GET /users/search only — never POST/PUT/DELETE.
 * Write/provision path: ghlAgencyUserProvisioning.service.js
 *
 * GHL Location ≠ GHL Team User ≠ GHL CRM Contact.
 */

const {
  createGhlAgencyApiClient,
  sanitizeAgencyAxiosError,
} = require("./ghlAgency.client");
const { getAgencyCompanyId } = require("./ghlAccountLocation.service");

const GHL_ELIGIBLE_LC_ROLES = Object.freeze(["BROKER_ADMIN", "BROKER_OFFICER"]);

const RECONCILE_RESULTS = Object.freeze({
  MATCHED: "MATCHED",
  NOT_PROVISIONED: "NOT_PROVISIONED",
  AMBIGUOUS: "AMBIGUOUS",
  NOT_ELIGIBLE: "NOT_ELIGIBLE",
  NOT_CONFIGURED: "NOT_CONFIGURED",
  USER_NOT_FOUND: "USER_NOT_FOUND",
  ORG_MISMATCH: "ORG_MISMATCH",
  ERROR: "ERROR",
});

function pickString(...values) {
  for (const value of values) {
    if (value == null) continue;
    const s = String(value).trim();
    if (s) return s;
  }
  return null;
}

function normalizeEmail(email) {
  if (email == null) return null;
  const normalized = String(email).trim().toLowerCase();
  return normalized || null;
}

/**
 * Only BROKER_ADMIN and BROKER_OFFICER may ever map to GHL team users.
 * SUB_BROKER and unknown roles are never eligible.
 */
function isGhlEligibleLendingCartRole(role) {
  const code = String(role || "")
    .trim()
    .toUpperCase();
  if (!code) return false;
  return GHL_ELIGIBLE_LC_ROLES.includes(code);
}

function extractUsersArray(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.users)) return data.users;
  if (Array.isArray(data.data?.users)) return data.data.users;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

function normalizeGhlAgencyUser(raw = {}, fallbackLocationId = null) {
  const first = pickString(raw.firstName, raw.first_name);
  const last = pickString(raw.lastName, raw.last_name);
  const name =
    pickString(raw.name) ||
    [first, last].filter(Boolean).join(" ").trim() ||
    null;

  let role = null;
  if (typeof raw.role === "string") role = raw.role;
  else if (raw.roles && typeof raw.roles === "object" && !Array.isArray(raw.roles)) {
    role = pickString(raw.roles.type, raw.roles.role, raw.roles.name);
  } else if (Array.isArray(raw.roles)) {
    role = raw.roles
      .map((r) => (typeof r === "string" ? r : r?.name || r?.type))
      .filter(Boolean)
      .join(",");
  }

  let status = null;
  if (raw.deleted === true) status = "deleted";
  else if (raw.deleted === false) status = "active";
  else status = pickString(raw.status, raw.userStatus) || "active";

  const locationIds = Array.isArray(raw.locationIds)
    ? raw.locationIds
    : Array.isArray(raw.locations)
      ? raw.locations
          .map((l) => (typeof l === "string" ? l : l?.id))
          .filter(Boolean)
      : [];

  const locationId = pickString(raw.locationId, locationIds[0], fallbackLocationId);
  const uniqueLocationIds = [...locationIds];
  if (locationId && !uniqueLocationIds.includes(locationId)) {
    uniqueLocationIds.unshift(locationId);
  }

  return {
    userId: pickString(raw.id, raw.userId, raw._id),
    name,
    email: normalizeEmail(raw.email),
    role,
    locationId,
    locationIds: uniqueLocationIds,
    status,
  };
}

/**
 * Active Agency location mapping for an organization (DB only — no GHL call).
 */
async function getGhlLocationForOrganization(prisma, organizationId) {
  const orgId = String(organizationId || "").trim();
  if (!orgId) return null;

  const mapping = await prisma.organizationGhlAgencyLocation.findUnique({
    where: { organizationId: orgId },
  });

  if (!mapping || mapping.status !== "ACTIVE") return null;
  return mapping;
}

/**
 * GET /users/search — read-only list of Agency GHL team users for a location.
 * @param {{ locationId: string, companyId?: string|null, client?: object }} options
 */
async function listAgencyUsersForLocation({
  locationId,
  companyId = null,
  client = null,
} = {}) {
  const locId = pickString(locationId);
  if (!locId) {
    throw Object.assign(new Error("locationId is required"), {
      code: "MISSING_LOCATION_ID",
      statusCode: 400,
    });
  }

  const resolvedCompanyId =
    pickString(companyId) ||
    (() => {
      try {
        return getAgencyCompanyId();
      } catch {
        return null;
      }
    })();

  if (!resolvedCompanyId) {
    throw Object.assign(new Error("companyId is required for /users/search"), {
      code: "MISSING_COMPANY_ID",
      statusCode: 400,
    });
  }

  const api = client || createGhlAgencyApiClient();
  const res = await api.get("/users/search", {
    params: {
      locationId: locId,
      companyId: resolvedCompanyId,
    },
  });

  const users = extractUsersArray(res.data)
    .map((u) => normalizeGhlAgencyUser(u, locId))
    .filter((u) => Boolean(u.userId));

  return {
    locationId: locId,
    companyId: resolvedCompanyId,
    users,
    count: users.length,
  };
}

/**
 * Find GHL team users matching email (trim + lowercase). Never matches by name.
 */
async function findAgencyUserByEmail({
  locationId,
  companyId = null,
  email,
  client = null,
} = {}) {
  const target = normalizeEmail(email);
  if (!target) {
    return { matches: [], targetEmail: null };
  }

  const listed = await listAgencyUsersForLocation({
    locationId,
    companyId,
    client,
  });

  const matches = listed.users.filter(
    (u) => normalizeEmail(u.email) === target,
  );

  return {
    matches,
    targetEmail: target,
    locationId: listed.locationId,
    companyId: listed.companyId,
  };
}

function primaryLendingCartRole(roles = []) {
  const names = (Array.isArray(roles) ? roles : [])
    .map((r) => {
      if (typeof r === "string") return r.trim().toUpperCase();
      return String(r?.role?.name || r?.name || "")
        .trim()
        .toUpperCase();
    })
    .filter(Boolean);

  // Prefer explicit eligibility order when multiple roles exist.
  for (const preferred of GHL_ELIGIBLE_LC_ROLES) {
    if (names.includes(preferred)) return preferred;
  }
  if (names.includes("SUB_BROKER")) return "SUB_BROKER";
  return names[0] || null;
}

/**
 * Read-only reconcile: LC user email ↔ GHL team user in the org's Agency location.
 * Does NOT persist and does NOT call GHL write APIs.
 *
 * @param {object} prisma
 * @param {{ organizationId: string, userId: string, client?: object }} args
 */
async function reconcileOrganizationGhlAgencyUser(
  prisma,
  { organizationId, userId, client = null } = {},
) {
  const orgId = String(organizationId || "").trim();
  const uid = String(userId || "").trim();

  const base = {
    result: null,
    organizationId: orgId || null,
    userId: uid || null,
    role: null,
    email: null,
    ghlLocationId: null,
    ghlCompanyId: null,
    ghlUser: null,
    matches: [],
    reason: null,
    ghlApiCalled: false,
  };

  if (!orgId || !uid) {
    return {
      ...base,
      result: RECONCILE_RESULTS.ERROR,
      reason: "organizationId and userId are required",
    };
  }

  const user = await prisma.userAccount.findUnique({
    where: { id: uid },
    include: {
      roles: { include: { role: true } },
    },
  });

  if (!user || user.isDeleted) {
    return {
      ...base,
      result: RECONCILE_RESULTS.USER_NOT_FOUND,
      reason: "LendingCart user not found",
    };
  }

  if (user.organizationId && user.organizationId !== orgId) {
    return {
      ...base,
      email: normalizeEmail(user.email),
      result: RECONCILE_RESULTS.ORG_MISMATCH,
      reason: "User does not belong to the given organization",
    };
  }

  const role = primaryLendingCartRole(user.roles);
  const email = normalizeEmail(user.email);

  if (role === "SUB_BROKER" || !isGhlEligibleLendingCartRole(role)) {
    return {
      ...base,
      role,
      email,
      result: RECONCILE_RESULTS.NOT_ELIGIBLE,
      reason:
        role === "SUB_BROKER"
          ? "SUB_BROKER users must never be provisioned as GHL team users"
          : `Role ${role || "(none)"} is not eligible for GHL team-user mapping`,
      ghlApiCalled: false,
    };
  }

  const agencyLocation = await getGhlLocationForOrganization(prisma, orgId);
  if (!agencyLocation) {
    return {
      ...base,
      role,
      email,
      result: RECONCILE_RESULTS.NOT_CONFIGURED,
      reason: "Organization has no active Agency GHL location mapping",
      ghlApiCalled: false,
    };
  }

  try {
    const found = await findAgencyUserByEmail({
      locationId: agencyLocation.ghlLocationId,
      companyId: agencyLocation.ghlCompanyId,
      email,
      client,
    });

    if (found.matches.length === 1) {
      return {
        ...base,
        role,
        email,
        ghlLocationId: agencyLocation.ghlLocationId,
        ghlCompanyId: agencyLocation.ghlCompanyId,
        result: RECONCILE_RESULTS.MATCHED,
        ghlUser: found.matches[0],
        matches: found.matches,
        reason: "Exactly one GHL team user matched the LendingCart email",
        ghlApiCalled: true,
      };
    }

    if (found.matches.length === 0) {
      return {
        ...base,
        role,
        email,
        ghlLocationId: agencyLocation.ghlLocationId,
        ghlCompanyId: agencyLocation.ghlCompanyId,
        result: RECONCILE_RESULTS.NOT_PROVISIONED,
        matches: [],
        reason: "No GHL team user matched the LendingCart user's email",
        ghlApiCalled: true,
      };
    }

    return {
      ...base,
      role,
      email,
      ghlLocationId: agencyLocation.ghlLocationId,
      ghlCompanyId: agencyLocation.ghlCompanyId,
      result: RECONCILE_RESULTS.AMBIGUOUS,
      matches: found.matches,
      reason: "Multiple GHL team users matched the same email",
      ghlApiCalled: true,
    };
  } catch (err) {
    const sanitized = sanitizeAgencyAxiosError(err);
    return {
      ...base,
      role,
      email,
      ghlLocationId: agencyLocation.ghlLocationId,
      ghlCompanyId: agencyLocation.ghlCompanyId,
      result: RECONCILE_RESULTS.ERROR,
      reason:
        sanitized.data?.message ||
        sanitized.message ||
        "Failed to list Agency GHL users",
      ghlApiCalled: true,
      providerStatus: sanitized.status,
    };
  }
}

/**
 * Optional persistence helper — NOT called by reconcileOrganizationGhlAgencyUser.
 * Use only when a MATCHED result should be stored explicitly.
 */
async function saveAgencyUserMapping(
  prisma,
  {
    organizationId,
    userId,
    ghlUserId,
    ghlLocationId,
    email,
    status = "ACTIVE",
  },
) {
  const orgId = String(organizationId || "").trim();
  const uid = String(userId || "").trim();
  const ghlUid = pickString(ghlUserId);
  const locId = pickString(ghlLocationId);
  const normalized = normalizeEmail(email);

  if (!orgId || !uid || !ghlUid || !locId || !normalized) {
    throw Object.assign(
      new Error(
        "organizationId, userId, ghlUserId, ghlLocationId, and email are required",
      ),
      { code: "INVALID_MAPPING_PAYLOAD", statusCode: 400 },
    );
  }

  const now = new Date();
  return prisma.organizationGhlAgencyUser.upsert({
    where: { userId: uid },
    create: {
      organizationId: orgId,
      userId: uid,
      ghlUserId: ghlUid,
      ghlLocationId: locId,
      email: normalized,
      status,
      matchedAt: now,
      lastError: null,
    },
    update: {
      organizationId: orgId,
      ghlUserId: ghlUid,
      ghlLocationId: locId,
      email: normalized,
      status,
      matchedAt: now,
      lastError: null,
    },
  });
}

/**
 * Match a normalized email against a pre-fetched GHL user list (read-only).
 * Same rules as findAgencyUserByEmail — email only, trim+lowercase.
 */
function matchGhlUsersByEmail(ghlUsers, email) {
  const target = normalizeEmail(email);
  if (!target) return [];
  return (Array.isArray(ghlUsers) ? ghlUsers : []).filter(
    (u) => normalizeEmail(u.email) === target,
  );
}

/**
 * Org-wide read-only audit: eligible LC users vs Agency GHL team users.
 * Does NOT persist mappings. Does NOT call GHL write APIs.
 * Lists GHL users once (GET /users/search) when an active Agency location exists.
 *
 * @param {object} prisma
 * @param {{ organizationId: string, client?: object }} args
 */
async function auditOrganizationGhlAgencyUsers(
  prisma,
  { organizationId, client = null } = {},
) {
  const orgId = String(organizationId || "").trim();
  if (!orgId) {
    return {
      organizationId: null,
      organizationName: null,
      ghlLocationId: null,
      ghlCompanyId: null,
      configured: false,
      ghlApiCalled: false,
      persisted: false,
      eligibleUsers: [],
      excludedSubBrokers: [],
      summary: {
        MATCHED: 0,
        NOT_PROVISIONED: 0,
        AMBIGUOUS: 0,
        NOT_CONFIGURED: 0,
        ERROR: 0,
        SUB_BROKER_EXCLUDED: 0,
        ELIGIBLE: 0,
      },
      reason: "organizationId is required",
    };
  }

  const organization = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true },
  });

  const users = await prisma.userAccount.findMany({
    where: {
      organizationId: orgId,
      isDeleted: false,
    },
    include: {
      roles: { include: { role: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const excludedSubBrokers = [];
  const eligibleCandidates = [];

  for (const user of users) {
    const role = primaryLendingCartRole(user.roles);
    if (role === "SUB_BROKER") {
      excludedSubBrokers.push({
        userId: user.id,
        role,
        email: normalizeEmail(user.email),
      });
      continue;
    }
    if (!isGhlEligibleLendingCartRole(role)) {
      continue;
    }
    eligibleCandidates.push({
      userId: user.id,
      role,
      email: normalizeEmail(user.email),
    });
  }

  const agencyLocation = await getGhlLocationForOrganization(prisma, orgId);
  const summary = {
    MATCHED: 0,
    NOT_PROVISIONED: 0,
    AMBIGUOUS: 0,
    NOT_CONFIGURED: 0,
    ERROR: 0,
    SUB_BROKER_EXCLUDED: excludedSubBrokers.length,
    ELIGIBLE: eligibleCandidates.length,
  };

  if (!agencyLocation) {
    const eligibleUsers = eligibleCandidates.map((u) => ({
      ...u,
      ghlLocationId: null,
      result: RECONCILE_RESULTS.NOT_CONFIGURED,
      reason: "Organization has no active Agency GHL location mapping",
      ghlUser: null,
      matches: [],
    }));
    summary.NOT_CONFIGURED = eligibleUsers.length;

    return {
      organizationId: orgId,
      organizationName: organization?.name || null,
      ghlLocationId: null,
      ghlCompanyId: null,
      configured: false,
      ghlApiCalled: false,
      persisted: false,
      eligibleUsers,
      excludedSubBrokers,
      summary,
      reason: "Organization has no active Agency GHL location mapping",
    };
  }

  let ghlUsers = [];
  let listError = null;
  let ghlApiCalled = false;

  try {
    const listed = await listAgencyUsersForLocation({
      locationId: agencyLocation.ghlLocationId,
      companyId: agencyLocation.ghlCompanyId,
      client,
    });
    ghlUsers = listed.users;
    ghlApiCalled = true;
  } catch (err) {
    const sanitized = sanitizeAgencyAxiosError(err);
    listError =
      sanitized.data?.message ||
      sanitized.message ||
      "Failed to list Agency GHL users";
    ghlApiCalled = true;
  }

  const eligibleUsers = eligibleCandidates.map((u) => {
    if (listError) {
      summary.ERROR += 1;
      return {
        ...u,
        ghlLocationId: agencyLocation.ghlLocationId,
        result: RECONCILE_RESULTS.ERROR,
        reason: listError,
        ghlUser: null,
        matches: [],
      };
    }

    const matches = matchGhlUsersByEmail(ghlUsers, u.email);
    if (matches.length === 1) {
      summary.MATCHED += 1;
      return {
        ...u,
        ghlLocationId: agencyLocation.ghlLocationId,
        result: RECONCILE_RESULTS.MATCHED,
        reason: "Exactly one GHL team user matched the LendingCart email",
        ghlUser: matches[0],
        matches,
      };
    }
    if (matches.length === 0) {
      summary.NOT_PROVISIONED += 1;
      return {
        ...u,
        ghlLocationId: agencyLocation.ghlLocationId,
        result: RECONCILE_RESULTS.NOT_PROVISIONED,
        reason: "No GHL team user matched the LendingCart user's email",
        ghlUser: null,
        matches: [],
      };
    }
    summary.AMBIGUOUS += 1;
    return {
      ...u,
      ghlLocationId: agencyLocation.ghlLocationId,
      result: RECONCILE_RESULTS.AMBIGUOUS,
      reason: "Multiple GHL team users matched the same email",
      ghlUser: null,
      matches,
    };
  });

  return {
    organizationId: orgId,
    organizationName: organization?.name || null,
    ghlLocationId: agencyLocation.ghlLocationId,
    ghlCompanyId: agencyLocation.ghlCompanyId,
    configured: true,
    ghlApiCalled,
    persisted: false,
    eligibleUsers,
    excludedSubBrokers,
    summary,
    reason: null,
  };
}

/**
 * DB-only list of LendingCart users eligible for Agency GHL team-user provisioning.
 * Does NOT call GHL. Does NOT mutate the database.
 * Safe fields only: id, firstName, lastName, email, role.
 *
 * @param {object} prisma
 * @param {{ organizationId: string }} args
 */
async function listOrganizationEligibleGhlUsers(
  prisma,
  { organizationId } = {},
) {
  const orgId = String(organizationId || "").trim();
  if (!orgId) {
    return {
      organizationId: null,
      organizationName: null,
      users: [],
      excludedSubBrokerCount: 0,
      reason: "organizationId is required",
    };
  }

  const organization = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true },
  });

  const accounts = await prisma.userAccount.findMany({
    where: {
      organizationId: orgId,
      isDeleted: false,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      roles: {
        select: {
          role: {
            select: { name: true },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const users = [];
  let excludedSubBrokerCount = 0;

  for (const account of accounts) {
    const role = primaryLendingCartRole(account.roles);
    if (role === "SUB_BROKER") {
      excludedSubBrokerCount += 1;
      continue;
    }
    if (!isGhlEligibleLendingCartRole(role)) {
      continue;
    }
    users.push({
      id: account.id,
      firstName: account.firstName || null,
      lastName: account.lastName || null,
      email: normalizeEmail(account.email),
      role,
    });
  }

  return {
    organizationId: orgId,
    organizationName: organization?.name || null,
    users,
    excludedSubBrokerCount,
    reason: organization ? null : "Organization not found",
  };
}

module.exports = {
  GHL_ELIGIBLE_LC_ROLES,
  RECONCILE_RESULTS,
  normalizeEmail,
  normalizeGhlAgencyUser,
  isGhlEligibleLendingCartRole,
  getGhlLocationForOrganization,
  listAgencyUsersForLocation,
  findAgencyUserByEmail,
  matchGhlUsersByEmail,
  reconcileOrganizationGhlAgencyUser,
  auditOrganizationGhlAgencyUsers,
  listOrganizationEligibleGhlUsers,
  saveAgencyUserMapping,
  primaryLendingCartRole,
};
