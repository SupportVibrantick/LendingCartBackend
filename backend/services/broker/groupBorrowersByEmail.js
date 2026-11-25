const {
  resolveClientDisplayNameFromData,
  resolveApplicationBorrowerEmail,
  resolveClientPhoneFromData,
} = require("../messaging/resolveClientDisplayName");

function getActiveSubmissions(submissions = []) {
  return submissions.filter((s) => s.status !== "SUPERSEDED");
}

function getLatestSubmission(submissions = []) {
  const active = getActiveSubmissions(submissions);
  if (!active.length) return null;
  return active.reduce((latest, current) =>
    !latest || new Date(current.createdAt) > new Date(latest.createdAt)
      ? current
      : latest,
  );
}

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function compareNullableString(a, b, sortOrder) {
  const left = String(a || "").toLowerCase();
  const right = String(b || "").toLowerCase();
  if (left === right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  const result = left.localeCompare(right);
  return sortOrder === "asc" ? result : -result;
}

function compareDate(a, b, sortOrder) {
  const left = a ? new Date(a).getTime() : 0;
  const right = b ? new Date(b).getTime() : 0;
  return sortOrder === "asc" ? left - right : right - left;
}

/**
 * Map raw loan applications into borrower rows, then group by email
 * (fallback: clientId, then application id) so one portal identity = one row.
 */
function groupBorrowersByEmail(applications = [], options = {}) {
  const {
    page = 1,
    limit = 20,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = options;

  const groups = new Map();

  for (const app of applications) {
    const submissions = app.submissions || [];
    const latestSubmission = getLatestSubmission(submissions);
    const email =
      resolveApplicationBorrowerEmail(app.client, submissions) || "";
    const normalizedEmail = normalizeEmail(email);
    const name = resolveClientDisplayNameFromData(app.client, submissions);
    const phone = resolveClientPhoneFromData(app.client, submissions) || "";
    const clientId = app.client?.id || null;

    const groupKey = normalizedEmail
      ? `email:${normalizedEmail}`
      : clientId
        ? `client:${clientId}`
        : `app:${app.id}`;

    const loan = {
      applicationId: app.id,
      applicationNumber: app.applicationNumber || "",
      applicationStatus: app.status,
      submissionId: latestSubmission?.id || null,
      createdAt: app.createdAt,
    };

    const existing = groups.get(groupKey);
    if (!existing) {
      groups.set(groupKey, {
        id: groupKey,
        clientId,
        name: name || "Client",
        email,
        phone,
        createdAt: app.createdAt,
        applications: [loan],
      });
      continue;
    }

    existing.applications.push(loan);

    if (!existing.clientId && clientId) existing.clientId = clientId;
    if ((!existing.email || !existing.email.trim()) && email) {
      existing.email = email;
    }
    if ((!existing.phone || !existing.phone.trim()) && phone) {
      existing.phone = phone;
    }
    if (
      (!existing.name || existing.name === "Client") &&
      name &&
      name !== "Client"
    ) {
      existing.name = name;
    }
    if (new Date(app.createdAt) > new Date(existing.createdAt)) {
      existing.createdAt = app.createdAt;
    }
  }

  const rows = Array.from(groups.values()).map((group) => {
    const applications = [...group.applications].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    );
    const primary = applications[0];

    return {
      id: group.id,
      clientId: group.clientId,
      name: group.name,
      email: group.email,
      phone: group.phone,
      createdAt: group.createdAt,
      applicationCount: applications.length,
      // Latest loan — used for default Open / status column
      applicationId: primary?.applicationId || null,
      applicationNumber: primary?.applicationNumber || "",
      applicationStatus: primary?.applicationStatus || null,
      submissionId: primary?.submissionId || null,
      applications,
    };
  });

  rows.sort((a, b) => {
    switch (sortBy) {
      case "name":
        return compareNullableString(a.name, b.name, sortOrder);
      case "email":
        return compareNullableString(a.email, b.email, sortOrder);
      case "phone":
        return compareNullableString(a.phone, b.phone, sortOrder);
      case "applicationNumber":
        return compareNullableString(
          a.applicationNumber,
          b.applicationNumber,
          sortOrder,
        );
      case "createdAt":
      default:
        return compareDate(a.createdAt, b.createdAt, sortOrder);
    }
  });

  const totalClients = rows.length;
  const portalReady = rows.filter((row) => Boolean(row.clientId)).length;
  const pendingLink = totalClients - portalReady;
  const totalApplications = applications.length;

  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
  const totalPages = Math.ceil(totalClients / safeLimit) || 1;
  const start = (safePage - 1) * safeLimit;
  const data = rows.slice(start, start + safeLimit);

  return {
    data,
    stats: {
      total: totalClients,
      portalReady,
      pendingLink,
      applications: totalApplications,
    },
    pagination: {
      total: totalClients,
      page: safePage,
      limit: safeLimit,
      totalPages,
    },
  };
}

module.exports = {
  getLatestSubmission,
  groupBorrowersByEmail,
  normalizeEmail,
};
