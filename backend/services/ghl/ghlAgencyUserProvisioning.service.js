/**
 * Agency GHL team-user provisioning (write path).
 *
 * Separate from ghlAgencyUsers.service.js (read-only reconciliation).
 * Uses Agency Private Integration only — not OrganizationGhlConnection / broker OAuth.
 *
 * Verified Create User contract (HighLevel Marketplace Users API, Version 2021-07-28):
 *   POST /users/
 *   required: companyId, firstName, lastName, email, password, type, role, locationIds
 *   type: "account" | "agency"
 *   role: "admin" | "user"
 *
 * Do NOT pass empty `scopes` / `scopesAssignedToOnly` — empty arrays disable all scopes.
 * Do NOT invent invite endpoints; Create User is the documented write path.
 *
 * Delete/deactivate is intentionally not used by provisionOrganizationGhlAgencyUser —
 * DELETE /users/:userId exists in Marketplace docs but is not part of this provisioning flow.
 */

const crypto = require("crypto");
const {
  createGhlAgencyApiClient,
  sanitizeAgencyAxiosError,
} = require("./ghlAgency.client");
const {
  GHL_ELIGIBLE_LC_ROLES,
  normalizeEmail,
  normalizeGhlAgencyUser,
  isGhlEligibleLendingCartRole,
  getGhlLocationForOrganization,
  findAgencyUserByEmail,
  saveAgencyUserMapping,
  primaryLendingCartRole,
} = require("./ghlAgencyUsers.service");
const { commonLogs } = require("../logger/contextLogger");

const PROVISION_RESULTS = Object.freeze({
  CREATED: "CREATED",
  REUSED: "REUSED",
  UPDATED: "UPDATED",
  ALREADY_PROVISIONED: "ALREADY_PROVISIONED",
  DRY_RUN: "DRY_RUN",
  NOT_ELIGIBLE: "NOT_ELIGIBLE",
  NOT_CONFIGURED: "NOT_CONFIGURED",
  AMBIGUOUS: "AMBIGUOUS",
  USER_NOT_FOUND: "USER_NOT_FOUND",
  ORG_MISMATCH: "ORG_MISMATCH",
  ERROR: "ERROR",
});

/** LendingCart role → GHL account role (Marketplace: admin | user). */
const LC_ROLE_TO_GHL_ROLE = Object.freeze({
  BROKER_ADMIN: "admin",
  BROKER_OFFICER: "user",
});

function redactSecrets(text) {
  return String(text || "")
    .slice(0, 500)
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/GHL_AGENCY_PRIVATE_TOKEN\s*=\s*\S+/gi, "GHL_AGENCY_PRIVATE_TOKEN=[REDACTED]")
    .replace(/\bpit-[A-Za-z0-9]+\b/gi, "[REDACTED]")
    .replace(/"password"\s*:\s*"[^"]*"/gi, '"password":"[REDACTED]"');
}

function sanitizeErrorMessage(err) {
  const sanitized = err?.response
    ? sanitizeAgencyAxiosError(err)
    : { message: String(err?.message || err || "Agency user provisioning failed") };
  const raw =
    sanitized.data?.message ||
    sanitized.data?.msg ||
    sanitized.data?.error ||
    sanitized.message ||
    "Agency user provisioning failed";
  return redactSecrets(raw);
}

function logProvisionError(event, payload) {
  try {
    commonLogs.error(event, {
      ...payload,
      message: redactSecrets(payload.message),
    });
  } catch {
    // never throw from logging
  }
}

/**
 * Temp password for POST /users/ (required by API). Never logged or persisted.
 * Meets typical GHL complexity: length + upper + lower + digit + symbol.
 */
function generateTempAgencyUserPassword() {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%^&*";
  const all = upper + lower + digits + symbols;
  const pick = (alphabet) => alphabet[crypto.randomInt(0, alphabet.length)];
  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  for (let i = chars.length; i < 24; i += 1) {
    chars.push(pick(all));
  }
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

function mapLendingCartRoleToGhlRole(lcRole) {
  const code = String(lcRole || "")
    .trim()
    .toUpperCase();
  return LC_ROLE_TO_GHL_ROLE[code] || null;
}

function extractCreatedUser(data, fallbackLocationId = null) {
  const raw = data?.user || data?.data || data || {};
  return normalizeGhlAgencyUser(raw, fallbackLocationId);
}

function collectLocationIds(ghlUser) {
  const ids = [];
  if (Array.isArray(ghlUser?.locationIds)) {
    for (const id of ghlUser.locationIds) {
      const s = String(id || "").trim();
      if (s && !ids.includes(s)) ids.push(s);
    }
  }
  if (ghlUser?.locationId) {
    const s = String(ghlUser.locationId).trim();
    if (s && !ids.includes(s)) ids.push(s);
  }
  return ids;
}

/**
 * POST /users/ — verified Marketplace Create User body (required fields only).
 * Omits permissions/scopes so GHL defaults apply (empty scopes would disable all).
 */
async function createAgencyUser({
  companyId,
  locationId,
  email,
  firstName,
  lastName,
  ghlRole,
  phone = null,
  client = null,
} = {}) {
  const api = client || createGhlAgencyApiClient();
  const payload = {
    companyId: String(companyId).trim(),
    firstName: String(firstName || "User").trim() || "User",
    lastName: String(lastName || "Account").trim() || "Account",
    email: normalizeEmail(email),
    password: generateTempAgencyUserPassword(),
    type: "account",
    role: ghlRole,
    locationIds: [String(locationId).trim()],
  };
  if (phone && String(phone).trim()) {
    payload.phone = String(phone).trim();
  }

  const res = await api.post("/users/", payload);
  return {
    httpStatus: res.status,
    user: extractCreatedUser(res.data, locationId),
    raw: res.data,
    // Caller must never log or persist this. Used only to email the broker once.
    tempPassword: payload.password,
  };
}

/**
 * PUT /users/:userId — verified Marketplace Update User.
 * Used to ensure locationIds includes the org Agency location when reusing.
 */
async function updateAgencyUser({
  ghlUserId,
  companyId,
  locationIds,
  firstName = null,
  lastName = null,
  ghlRole = null,
  client = null,
} = {}) {
  const api = client || createGhlAgencyApiClient();
  const body = {
    companyId: String(companyId).trim(),
    locationIds: (Array.isArray(locationIds) ? locationIds : [])
      .map((id) => String(id).trim())
      .filter(Boolean),
  };
  if (firstName) body.firstName = String(firstName).trim();
  if (lastName) body.lastName = String(lastName).trim();
  if (ghlRole) body.role = ghlRole;

  const res = await api.put(`/users/${encodeURIComponent(ghlUserId)}`, body);
  return {
    httpStatus: res.status,
    user: extractCreatedUser(res.data, body.locationIds[0] || null),
    raw: res.data,
  };
}

async function markMappingError(
  prisma,
  {
    organizationId,
    userId,
    email,
    ghlLocationId,
    ghlUserId = null,
    lastError,
  },
) {
  if (!prisma?.organizationGhlAgencyUser) return null;

  const existing = await prisma.organizationGhlAgencyUser.findUnique({
    where: { userId },
  });

  const message = redactSecrets(lastError).slice(0, 500);
  const now = new Date();

  if (existing) {
    return prisma.organizationGhlAgencyUser.update({
      where: { userId },
      data: {
        status: "ERROR",
        lastError: message,
        email: normalizeEmail(email) || existing.email,
        ghlLocationId: ghlLocationId || existing.ghlLocationId,
        ...(ghlUserId ? { ghlUserId } : {}),
      },
    });
  }

  // Schema requires ghlUserId; use a deterministic placeholder until a real GHL id exists.
  const placeholderId = ghlUserId || `error:${userId}`;
  try {
    return await prisma.organizationGhlAgencyUser.create({
      data: {
        organizationId,
        userId,
        ghlUserId: placeholderId,
        ghlLocationId: ghlLocationId || "unknown",
        email: normalizeEmail(email) || "unknown",
        status: "ERROR",
        lastError: message,
        matchedAt: null,
      },
    });
  } catch {
    return null;
  }
}

/**
 * Provision (or reuse) a GHL Agency team user for one LendingCart user.
 *
 * @param {object} prisma
 * @param {{
 *   organizationId: string,
 *   userId: string,
 *   dryRun?: boolean,
 *   client?: object,
 * }} args
 */
async function provisionOrganizationGhlAgencyUser(
  prisma,
  { organizationId, userId, dryRun = false, client = null } = {},
) {
  const orgId = String(organizationId || "").trim();
  const uid = String(userId || "").trim();
  const writes = [];

  const base = {
    result: null,
    organizationId: orgId || null,
    userId: uid || null,
    role: null,
    email: null,
    ghlLocationId: null,
    ghlCompanyId: null,
    ghlUser: null,
    mapping: null,
    dryRun: Boolean(dryRun),
    ghlApiCalled: false,
    ghlWriteCalled: false,
    writes,
    reason: null,
  };

  if (!orgId || !uid) {
    return {
      ...base,
      result: PROVISION_RESULTS.ERROR,
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
      result: PROVISION_RESULTS.USER_NOT_FOUND,
      reason: "LendingCart user not found",
    };
  }

  if (user.organizationId && user.organizationId !== orgId) {
    return {
      ...base,
      email: normalizeEmail(user.email),
      result: PROVISION_RESULTS.ORG_MISMATCH,
      reason: "User does not belong to the given organization",
    };
  }

  const role = primaryLendingCartRole(user.roles);
  const email = normalizeEmail(user.email);
  base.role = role;
  base.email = email;

  if (role === "SUB_BROKER" || !isGhlEligibleLendingCartRole(role)) {
    return {
      ...base,
      result: PROVISION_RESULTS.NOT_ELIGIBLE,
      reason:
        role === "SUB_BROKER"
          ? "SUB_BROKER users must never be provisioned as GHL team users"
          : `Role ${role || "(none)"} is not eligible for GHL team-user provisioning`,
      ghlApiCalled: false,
      ghlWriteCalled: false,
    };
  }

  if (!email) {
    return {
      ...base,
      result: PROVISION_RESULTS.ERROR,
      reason: "LendingCart user has no email",
    };
  }

  const agencyLocation = await getGhlLocationForOrganization(prisma, orgId);
  if (!agencyLocation) {
    return {
      ...base,
      result: PROVISION_RESULTS.NOT_CONFIGURED,
      reason: "Organization has no active Agency GHL location mapping",
      ghlApiCalled: false,
      ghlWriteCalled: false,
    };
  }

  const ghlLocationId = agencyLocation.ghlLocationId;
  const ghlCompanyId = agencyLocation.ghlCompanyId;
  base.ghlLocationId = ghlLocationId;
  base.ghlCompanyId = ghlCompanyId;

  const ghlRole = mapLendingCartRoleToGhlRole(role);
  if (!ghlRole) {
    return {
      ...base,
      result: PROVISION_RESULTS.NOT_ELIGIBLE,
      reason: `No GHL role mapping for LendingCart role ${role}`,
    };
  }

  // Idempotent short-circuit: existing ACTIVE mapping for same location+email.
  const existingMapping = await prisma.organizationGhlAgencyUser.findUnique({
    where: { userId: uid },
  });
  if (
    existingMapping &&
    existingMapping.status === "ACTIVE" &&
    existingMapping.ghlLocationId === ghlLocationId &&
    normalizeEmail(existingMapping.email) === email &&
    existingMapping.ghlUserId &&
    !String(existingMapping.ghlUserId).startsWith("error:")
  ) {
    if (dryRun) {
      return {
        ...base,
        result: PROVISION_RESULTS.DRY_RUN,
        mapping: existingMapping,
        ghlUser: {
          userId: existingMapping.ghlUserId,
          email,
          locationId: ghlLocationId,
        },
        reason:
          "Dry run: existing ACTIVE OrganizationGhlAgencyUser mapping would be reused (no GHL write)",
        plannedAction: "reuse_existing_mapping",
      };
    }
    return {
      ...base,
      result: PROVISION_RESULTS.ALREADY_PROVISIONED,
      mapping: existingMapping,
      ghlUser: {
        userId: existingMapping.ghlUserId,
        email,
        locationId: ghlLocationId,
        status: "active",
      },
      reason: "OrganizationGhlAgencyUser mapping already ACTIVE for this user/location",
    };
  }

  let found;
  try {
    found = await findAgencyUserByEmail({
      locationId: ghlLocationId,
      companyId: ghlCompanyId,
      email,
      client,
    });
    base.ghlApiCalled = true;
  } catch (err) {
    const message = sanitizeErrorMessage(err);
    logProvisionError("ghl.agency_user.provision_list_failed", {
      organizationId: orgId,
      userId: uid,
      code: "AGENCY_USER_LIST_FAILED",
      message,
    });
    const mapping = await markMappingError(prisma, {
      organizationId: orgId,
      userId: uid,
      email,
      ghlLocationId,
      lastError: message,
    });
    return {
      ...base,
      result: PROVISION_RESULTS.ERROR,
      mapping,
      reason: message,
      ghlApiCalled: true,
      ghlWriteCalled: false,
    };
  }

  const matches = found.matches;

  if (matches.length > 1) {
    return {
      ...base,
      result: PROVISION_RESULTS.AMBIGUOUS,
      reason: "Multiple GHL team users matched the same email — refusing to create",
      ghlApiCalled: true,
      ghlWriteCalled: false,
      matches,
    };
  }

  if (dryRun) {
    const plannedAction =
      matches.length === 1 ? "reuse_existing_ghl_user" : "create_ghl_user";
    return {
      ...base,
      result: PROVISION_RESULTS.DRY_RUN,
      ghlUser: matches[0] || null,
      plannedAction,
      plannedPayload:
        plannedAction === "create_ghl_user"
          ? {
              endpoint: "POST /users/",
              companyId: ghlCompanyId,
              firstName: user.firstName || "User",
              lastName: user.lastName || "Account",
              email,
              type: "account",
              role: ghlRole,
              locationIds: [ghlLocationId],
              password: "[GENERATED_NOT_SHOWN]",
            }
          : {
              endpoint: "PUT /users/:userId (only if location missing)",
              ghlUserId: matches[0]?.userId || null,
              companyId: ghlCompanyId,
              locationIds: [ghlLocationId],
            },
      reason: `Dry run: would ${plannedAction.replace(/_/g, " ")} — no POST/PUT/DELETE performed`,
      ghlWriteCalled: false,
    };
  }

  try {
    if (matches.length === 1) {
      const existing = matches[0];
      const locationIds = collectLocationIds(existing);
      let ghlUser = existing;
      let result = PROVISION_RESULTS.REUSED;

      if (!locationIds.includes(ghlLocationId)) {
        const updated = await updateAgencyUser({
          ghlUserId: existing.userId,
          companyId: ghlCompanyId,
          locationIds: [...locationIds, ghlLocationId],
          firstName: user.firstName || null,
          lastName: user.lastName || null,
          ghlRole,
          client,
        });
        writes.push({ method: "PUT", url: `/users/${existing.userId}` });
        base.ghlWriteCalled = true;
        ghlUser = updated.user?.userId
          ? updated.user
          : { ...existing, locationId: ghlLocationId };
        result = PROVISION_RESULTS.UPDATED;
      }

      const mapping = await saveAgencyUserMapping(prisma, {
        organizationId: orgId,
        userId: uid,
        ghlUserId: ghlUser.userId,
        ghlLocationId,
        email,
        status: "ACTIVE",
      });

      return {
        ...base,
        result,
        ghlUser,
        mapping,
        reason:
          result === PROVISION_RESULTS.UPDATED
            ? "Reused existing GHL user and added Agency location"
            : "Reused existing GHL team user with matching email",
        ghlApiCalled: true,
      };
    }

    // No match → create (retry-safe: on duplicate-email race, re-list and reuse).
    let created;
    try {
      created = await createAgencyUser({
        companyId: ghlCompanyId,
        locationId: ghlLocationId,
        email,
        firstName: user.firstName,
        lastName: user.lastName,
        ghlRole,
        phone: user.phone || null,
        client,
      });
      writes.push({ method: "POST", url: "/users/" });
      base.ghlWriteCalled = true;
    } catch (createErr) {
      const message = sanitizeErrorMessage(createErr);
      // Retry-safe: another process may have created the user; re-find by email.
      try {
        const again = await findAgencyUserByEmail({
          locationId: ghlLocationId,
          companyId: ghlCompanyId,
          email,
          client,
        });
        if (again.matches.length === 1) {
          const mapping = await saveAgencyUserMapping(prisma, {
            organizationId: orgId,
            userId: uid,
            ghlUserId: again.matches[0].userId,
            ghlLocationId,
            email,
            status: "ACTIVE",
          });
          return {
            ...base,
            result: PROVISION_RESULTS.REUSED,
            ghlUser: again.matches[0],
            mapping,
            reason:
              "Create failed but an existing GHL user matched email — reused (retry-safe)",
            ghlApiCalled: true,
            ghlWriteCalled: true,
            createError: message,
          };
        }
      } catch {
        // fall through to ERROR
      }

      logProvisionError("ghl.agency_user.provision_create_failed", {
        organizationId: orgId,
        userId: uid,
        code: "AGENCY_USER_CREATE_FAILED",
        message,
      });
      const mapping = await markMappingError(prisma, {
        organizationId: orgId,
        userId: uid,
        email,
        ghlLocationId,
        lastError: message,
      });
      return {
        ...base,
        result: PROVISION_RESULTS.ERROR,
        mapping,
        reason: message,
        ghlApiCalled: true,
        ghlWriteCalled: true,
      };
    }

    const ghlUser = created.user;
    if (!ghlUser?.userId) {
      const message = "GHL Create User succeeded but response had no user id";
      const mapping = await markMappingError(prisma, {
        organizationId: orgId,
        userId: uid,
        email,
        ghlLocationId,
        lastError: message,
      });
      return {
        ...base,
        result: PROVISION_RESULTS.ERROR,
        mapping,
        reason: message,
        ghlApiCalled: true,
        ghlWriteCalled: true,
      };
    }

    const mapping = await saveAgencyUserMapping(prisma, {
      organizationId: orgId,
      userId: uid,
      ghlUserId: ghlUser.userId,
      ghlLocationId,
      email,
      status: "ACTIVE",
    });

    await sendNewUserCredentialsEmailSafe({
      prisma,
      organizationId: orgId,
      userId: uid,
      email,
      firstName: user.firstName,
      ghlLocationId,
      ghlUserId: ghlUser.userId,
      tempPassword: created.tempPassword,
    });

    return {
      ...base,
      result: PROVISION_RESULTS.CREATED,
      ghlUser,
      mapping,
      reason: "Created GHL Agency team user and stored OrganizationGhlAgencyUser mapping",
      ghlApiCalled: true,
      ghlWriteCalled: true,
    };
  } catch (err) {
    const message = sanitizeErrorMessage(err);
    logProvisionError("ghl.agency_user.provision_failed", {
      organizationId: orgId,
      userId: uid,
      code: "AGENCY_USER_PROVISION_FAILED",
      message,
    });
    const mapping = await markMappingError(prisma, {
      organizationId: orgId,
      userId: uid,
      email,
      ghlLocationId,
      lastError: message,
    });
    return {
      ...base,
      result: PROVISION_RESULTS.ERROR,
      mapping,
      reason: message,
      ghlApiCalled: true,
    };
  }
}

async function sendNewUserCredentialsEmailSafe({
  prisma,
  organizationId,
  userId,
  email,
  firstName,
  ghlLocationId,
  ghlUserId,
  tempPassword,
}) {
  if (!tempPassword || !email) return;
  try {
    const {
      sendGhlAgencyUserCredentialsEmail,
    } = require("../emails/ghlAgencyUserCredentialsEmail");
    await sendGhlAgencyUserCredentialsEmail({
      prisma,
      organizationId,
      userId,
      email,
      firstName,
      ghlLocationId,
      ghlUserId,
      tempPassword,
    });
  } catch (err) {
    logProvisionError("ghl.agency_user.credentials_email_failed", {
      organizationId,
      userId,
      message: sanitizeErrorMessage(err),
    });
  }
}

/**
 * Provision every eligible org user (BROKER_ADMIN / BROKER_OFFICER).
 * SUB_BROKER / Co-Brokers are never included.
 * Best-effort: never throws.
 */
async function provisionEligibleOrganizationGhlAgencyUsers(
  prisma,
  { organizationId, client = null } = {},
) {
  const orgId = String(organizationId || "").trim();
  if (!orgId) {
    return {
      organizationId: null,
      eligibleCount: 0,
      excludedSubBrokerCount: 0,
      results: [],
      reason: "organizationId is required",
    };
  }

  const {
    listOrganizationEligibleGhlUsers,
  } = require("./ghlAgencyUsers.service");

  const listed = await listOrganizationEligibleGhlUsers(prisma, {
    organizationId: orgId,
  });

  const results = [];
  for (const user of listed.users || []) {
    const provisioned = await provisionOrganizationGhlAgencyUserSafe(prisma, {
      organizationId: orgId,
      userId: user.id,
      client,
    });
    results.push({
      userId: user.id,
      role: user.role,
      email: user.email,
      result: provisioned.result,
      reason: provisioned.reason || null,
      ghlWriteCalled: Boolean(provisioned.ghlWriteCalled),
    });
  }

  return {
    organizationId: orgId,
    eligibleCount: listed.users.length,
    excludedSubBrokerCount: listed.excludedSubBrokerCount || 0,
    results,
    reason: listed.reason || null,
  };
}

/**
 * Best-effort wrapper — never throws (safe for fulfillment wiring).
 */
async function provisionOrganizationGhlAgencyUserSafe(prisma, args) {
  try {
    return await provisionOrganizationGhlAgencyUser(prisma, args);
  } catch (err) {
    const message = sanitizeErrorMessage(err);
    logProvisionError("ghl.agency_user.provision_unhandled", {
      organizationId: args?.organizationId || null,
      userId: args?.userId || null,
      code: "AGENCY_USER_PROVISION_UNHANDLED",
      message,
    });
    return {
      result: PROVISION_RESULTS.ERROR,
      organizationId: args?.organizationId || null,
      userId: args?.userId || null,
      reason: message,
      ghlWriteCalled: false,
      dryRun: Boolean(args?.dryRun),
    };
  }
}

module.exports = {
  PROVISION_RESULTS,
  GHL_ELIGIBLE_LC_ROLES,
  LC_ROLE_TO_GHL_ROLE,
  mapLendingCartRoleToGhlRole,
  generateTempAgencyUserPassword,
  createAgencyUser,
  updateAgencyUser,
  provisionOrganizationGhlAgencyUser,
  provisionOrganizationGhlAgencyUserSafe,
  provisionEligibleOrganizationGhlAgencyUsers,
  redactSecrets,
};
