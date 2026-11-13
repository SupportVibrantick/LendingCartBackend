const { parseUserAgent } = require("../logger/parseUserAgent");

const SECTION_PRESETS = {
  all: {},
  login: {
    category: "SECURITY",
    actionIn: [
      "LOGIN_SUCCESS",
      "LOGIN_FAILED",
      "LOGOUT",
      "SESSION_EXPIRED",
      "PASSWORD_CHANGED",
      "PASSWORD_RESET",
      "ACCOUNT_LOCKED",
      "ACCOUNT_UNLOCKED",
    ],
  },
  broker: { dashboard: "BROKER" },
  lender: { dashboard: "LENDER" },
  loan_officer: {
    OR: [
      { action: { contains: "LOAN_OFFICER", mode: "insensitive" } },
      { entityType: { contains: "LoanOfficer", mode: "insensitive" } },
      {
        AND: [
          { dashboard: "BROKER" },
          {
            actorUser: {
              roles: { some: { role: { name: "BROKER_OFFICER" } } },
            },
          },
        ],
      },
    ],
  },
  application: {
    OR: [
      { category: "APPLICATION" },
      { entityType: { contains: "Application", mode: "insensitive" } },
      { entityType: { contains: "Loan", mode: "insensitive" } },
    ],
  },
  document: {
    OR: [
      { entityType: { contains: "Document", mode: "insensitive" } },
      { entityType: { contains: "SignForm", mode: "insensitive" } },
      { action: { contains: "DOCUMENT", mode: "insensitive" } },
      { action: { contains: "UPLOAD", mode: "insensitive" } },
    ],
  },
  financial: {
    OR: [
      { action: { contains: "COMMISSION", mode: "insensitive" } },
      { action: { contains: "PAYMENT", mode: "insensitive" } },
      { action: { contains: "PAYOUT", mode: "insensitive" } },
      { action: { contains: "INVOICE", mode: "insensitive" } },
      { entityType: { contains: "Commission", mode: "insensitive" } },
    ],
  },
  subscription: {
    OR: [
      { action: { contains: "SUBSCRIPTION", mode: "insensitive" } },
      { action: { contains: "TRIAL", mode: "insensitive" } },
      { entityType: { contains: "Subscription", mode: "insensitive" } },
    ],
  },
  user_management: { category: "USER_MANAGEMENT" },
  security: { category: "SECURITY" },
};

function extractMeta(row) {
  let parsed = null;
  if (row?.newValueJson) {
    try {
      parsed = JSON.parse(row.newValueJson);
    } catch {
      parsed = null;
    }
  }
  const meta = parsed?._meta || {};
  const uaParsed = parseUserAgent(row?.userAgent || meta.userAgent);
  const status =
    meta.status ||
    parsed?.status ||
    (String(row?.action || "").includes("FAILED") ? "FAILED" : "SUCCESS");

  return {
    status,
    browser: meta.browser || uaParsed.browser,
    os: meta.os || uaParsed.os,
    device: meta.device || uaParsed.device,
    description:
      parsed?.reason ||
      parsed?.message ||
      parsed?.event ||
      humanizeAction(row?.action),
  };
}

function humanizeAction(action) {
  if (!action) return "Activity";
  return String(action)
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildAuditWhere(query = {}) {
  const {
    action,
    category,
    entityType,
    entityId,
    actorUserId,
    actorOrgId,
    dashboard,
    section,
    startDate,
    endDate,
    search,
    status,
    role,
  } = query;

  const where = {};
  const and = [];

  const sectionKey = String(section || "all").toLowerCase();
  const preset = SECTION_PRESETS[sectionKey] || SECTION_PRESETS.all;

  if (preset.category) where.category = preset.category;
  if (preset.dashboard) where.dashboard = preset.dashboard;
  if (preset.actionIn) where.action = { in: preset.actionIn };
  if (preset.OR) and.push({ OR: preset.OR });

  if (action) where.action = action;
  if (category) where.category = category;
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;
  if (actorUserId) where.actorUserId = actorUserId;
  if (actorOrgId) where.actorOrgId = actorOrgId;
  if (dashboard && !preset.dashboard) where.dashboard = dashboard;

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  const searchTerm = String(search || "").trim();
  if (searchTerm) {
    and.push({
      OR: [
        { entityId: { contains: searchTerm, mode: "insensitive" } },
        { action: { contains: searchTerm, mode: "insensitive" } },
        { entityType: { contains: searchTerm, mode: "insensitive" } },
        { actorUser: { email: { contains: searchTerm, mode: "insensitive" } } },
        {
          actorUser: {
            firstName: { contains: searchTerm, mode: "insensitive" },
          },
        },
        {
          actorUser: { lastName: { contains: searchTerm, mode: "insensitive" } },
        },
        { actorOrg: { name: { contains: searchTerm, mode: "insensitive" } } },
      ],
    });
  }

  if (role) {
    and.push({
      actorUser: {
        roles: { some: { role: { name: String(role) } } },
      },
    });
  }

  // Status is stored in newValueJson _meta — approximate via action name for filters.
  if (status) {
    const s = String(status).toUpperCase();
    if (s === "FAILED") {
      and.push({
        OR: [
          { action: { contains: "FAILED", mode: "insensitive" } },
          { newValueJson: { contains: '"status":"FAILED"' } },
        ],
      });
    } else if (s === "SUCCESS") {
      and.push({
        NOT: {
          OR: [
            { action: { contains: "FAILED", mode: "insensitive" } },
            { newValueJson: { contains: '"status":"FAILED"' } },
          ],
        },
      });
    }
  }

  if (and.length) where.AND = and;
  return where;
}

function mapAuditRow(row) {
  const meta = extractMeta(row);
  const roles = (row.actorUser?.roles || []).map((r) => r.role?.name).filter(Boolean);
  return {
    id: row.id,
    createdAt: row.createdAt,
    action: row.action,
    category: row.category,
    dashboard: row.dashboard,
    entityType: row.entityType,
    entityId: row.entityId,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    oldValueJson: row.oldValueJson,
    newValueJson: row.newValueJson,
    actorUserId: row.actorUserId,
    actorOrgId: row.actorOrgId,
    actorUser: row.actorUser
      ? {
          id: row.actorUser.id,
          email: row.actorUser.email,
          firstName: row.actorUser.firstName,
          lastName: row.actorUser.lastName,
        }
      : null,
    actorOrg: row.actorOrg
      ? {
          id: row.actorOrg.id,
          name: row.actorOrg.name,
          type: row.actorOrg.type,
        }
      : null,
    userName:
      `${row.actorUser?.firstName || ""} ${row.actorUser?.lastName || ""}`.trim() ||
      "System",
    userEmail: row.actorUser?.email || null,
    organizationName: row.actorOrg?.name || null,
    userRole: roles[0] || null,
    roles,
    module: row.category,
    description: meta.description,
    browser: meta.browser,
    os: meta.os,
    device: meta.device,
    status: meta.status,
  };
}

const AUDIT_INCLUDE = {
  actorUser: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      roles: { include: { role: { select: { name: true } } } },
    },
  },
  actorOrg: {
    select: { id: true, name: true, type: true },
  },
};

async function getAuditAnalytics(prisma) {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalActivities,
    loginSuccess,
    loginFailed,
    logouts,
    brokerActivities,
    lenderActivities,
    recentLogins,
    securityEvents,
  ] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.count({ where: { action: "LOGIN_SUCCESS" } }),
    prisma.auditLog.count({ where: { action: "LOGIN_FAILED" } }),
    prisma.auditLog.count({ where: { action: "LOGOUT" } }),
    prisma.auditLog.count({ where: { dashboard: "BROKER" } }),
    prisma.auditLog.count({ where: { dashboard: "LENDER" } }),
    prisma.auditLog.count({
      where: { action: "LOGIN_SUCCESS", createdAt: { gte: since24h } },
    }),
    prisma.auditLog.count({
      where: { category: "SECURITY", createdAt: { gte: since7d } },
    }),
  ]);

  // Active sessions approximation: distinct users with LOGIN_SUCCESS in 24h
  // minus those who logged out after (best-effort; JWT is stateless).
  const activeSessionUsers = await prisma.auditLog.findMany({
    where: {
      action: "LOGIN_SUCCESS",
      createdAt: { gte: since24h },
      actorUserId: { not: null },
    },
    distinct: ["actorUserId"],
    select: { actorUserId: true },
  });

  return {
    totalActivities,
    activeSessions: activeSessionUsers.length,
    totalLoginEvents: loginSuccess + loginFailed,
    loginSuccess,
    loginFailed,
    logouts,
    failedLoginAttempts: loginFailed,
    brokerActivities,
    lenderActivities,
    recentLogins24h: recentLogins,
    securityEvents7d: securityEvents,
  };
}

module.exports = {
  SECTION_PRESETS,
  buildAuditWhere,
  mapAuditRow,
  extractMeta,
  AUDIT_INCLUDE,
  getAuditAnalytics,
  humanizeAction,
};
