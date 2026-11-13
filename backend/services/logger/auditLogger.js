const { sanitizeAuditValue, truncateJsonString } = require("./sanitizeAuditValue");
const { parseUserAgent } = require("./parseUserAgent");

function resolveActor(req, overrides = {}) {
  const user = req?.user || {};
  return {
    actorUserId:
      overrides.actorUserId ??
      user.id ??
      user.userId ??
      null,
    actorOrgId:
      overrides.actorOrgId ??
      user.organizationId ??
      user.orgId ??
      null,
  };
}

function clientMeta(req) {
  const ua = req?.headers?.["user-agent"] || req?.headers?.["User-Agent"];
  const parsed = parseUserAgent(ua);
  return {
    ipAddress: req?.ip || req?.headers?.["x-forwarded-for"] || null,
    userAgent: parsed.userAgent,
    browser: parsed.browser,
    os: parsed.os,
    device: parsed.device,
  };
}

function mergeJsonPayload(base, meta) {
  const payload = {
    ...(base && typeof base === "object" && !Array.isArray(base) ? base : base ? { value: base } : {}),
    _meta: meta,
  };
  return truncateJsonString(JSON.stringify(sanitizeAuditValue(payload)));
}

/**
 * Fire-and-forget audit write. Never throws to callers.
 */
async function logAudit({
  prisma,
  req,
  dashboard,
  category,
  entityType,
  entityId,
  action,
  oldValue = null,
  newValue = null,
  actorUserId = null,
  actorOrgId = null,
  status = null,
}) {
  try {
    const actors = resolveActor(req, { actorUserId, actorOrgId });
    const meta = {
      ...clientMeta(req),
      status: status || null,
    };

    setImmediate(() => {
      prisma.auditLog
        .create({
          data: {
            actorUserId: actors.actorUserId,
            actorOrgId: actors.actorOrgId,
            dashboard,
            category,
            entityType: String(entityType || "Unknown"),
            entityId: String(entityId || "unknown"),
            action: String(action || "UNKNOWN"),
            oldValueJson: oldValue
              ? truncateJsonString(JSON.stringify(sanitizeAuditValue(oldValue)))
              : null,
            newValueJson: newValue || status
              ? mergeJsonPayload(newValue, meta)
              : meta.userAgent || meta.ipAddress
                ? mergeJsonPayload({}, meta)
                : null,
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
          },
        })
        .catch((err) => {
          console.error("Audit log failed:", err.message);
        });
    });
  } catch (err) {
    console.error("Audit log failed:", err.message);
  }
}

/**
 * Auth / security events (login, logout, password, lock).
 */
async function logAuthEvent({
  prisma,
  req,
  dashboard,
  action,
  status = "SUCCESS",
  actorUserId = null,
  actorOrgId = null,
  email = null,
  roles = null,
  reason = null,
  entityId = null,
}) {
  return logAudit({
    prisma,
    req,
    dashboard,
    category: "SECURITY",
    entityType: "AuthSession",
    entityId: String(entityId || actorUserId || email || "unknown"),
    action,
    actorUserId,
    actorOrgId,
    status,
    newValue: {
      email: email || undefined,
      roles: roles || undefined,
      reason: reason || undefined,
      event: action,
      status,
    },
  });
}

module.exports = {
  logAudit,
  logAuthEvent,
  resolveActor,
  clientMeta,
  parseUserAgent,
};
