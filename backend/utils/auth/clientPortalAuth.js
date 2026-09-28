const jwt = require("jsonwebtoken");
const jwtSecret = require("./jwtSecret");

function getClientFromRequest(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { error: { code: 401, message: "Unauthorized" } };
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, jwtSecret);

    if (!decoded.clientId || decoded.role !== "CLIENT") {
      return { error: { code: 403, message: "Access denied" } };
    }

    return {
      clientId: decoded.clientId,
      userId: decoded.id,
      email: decoded.email,
    };
  } catch {
    return { error: { code: 401, message: "Invalid token" } };
  }
}

/**
 * A client portal login is tied to one ClientPortalUser.clientId, but the same
 * person (email) can have Client records under multiple brokers. Resolve every
 * client id that should be visible for this portal identity.
 */
async function resolvePortalClientIds(
  prisma,
  { portalUserId, clientId, email } = {},
) {
  const ids = new Set();
  if (clientId) ids.add(clientId);

  let portalEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

  if (portalUserId) {
    const user = await prisma.clientPortalUser.findFirst({
      where: { id: portalUserId, isDeleted: false },
      select: { email: true, clientId: true },
    });
    if (user?.clientId) ids.add(user.clientId);
    if (!portalEmail && user?.email) {
      portalEmail = String(user.email).trim().toLowerCase();
    }
  }

  if (portalEmail) {
    const contacts = await prisma.clientContact.findMany({
      where: {
        OR: [
          { email: portalEmail },
          { email: { equals: portalEmail, mode: "insensitive" } },
        ],
      },
      select: { clientId: true },
    });
    for (const contact of contacts) {
      if (contact.clientId) ids.add(contact.clientId);
    }

    const portalUsers = await prisma.clientPortalUser.findMany({
      where: {
        isDeleted: false,
        OR: [
          { email: portalEmail },
          { email: { equals: portalEmail, mode: "insensitive" } },
        ],
      },
      select: { clientId: true },
    });
    for (const user of portalUsers) {
      if (user.clientId) ids.add(user.clientId);
    }
  }

  return Array.from(ids);
}

async function resolveUploadTokenClientEmail(prisma, clientId) {
  if (!clientId) return "";

  const contact = await prisma.clientContact.findFirst({
    where: { clientId },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    select: { email: true },
  });
  if (contact?.email) {
    return String(contact.email).trim().toLowerCase();
  }

  const portalUser = await prisma.clientPortalUser.findFirst({
    where: { clientId, isDeleted: false },
    select: { email: true },
  });
  return portalUser?.email
    ? String(portalUser.email).trim().toLowerCase()
    : "";
}

async function resolveClientPortalAccess(
  prisma,
  req,
  { applicationId } = {},
) {
  // Prefer a valid client JWT when present. Invite links often keep ?token= in
  // the URL after login; that upload token is loan-scoped and would incorrectly
  // block opening other applications shown in the portal list.
  const clientAuth = getClientFromRequest(req);
  if (!clientAuth.error) {
    if (!applicationId) {
      return { error: { code: 400, message: "Application id is required" } };
    }

    return {
      clientId: clientAuth.clientId,
      applicationId,
      userId: clientAuth.userId,
      email: clientAuth.email,
    };
  }

  const uploadToken = req.query?.token;
  if (!uploadToken) {
    return clientAuth;
  }

  const tokenRecord = await prisma.clientUploadToken.findUnique({
    where: { token: uploadToken },
    select: {
      clientId: true,
      loanApplicationId: true,
      expiresAt: true,
    },
  });

  if (!tokenRecord) {
    return {
      error: { code: 404, message: "Invalid or expired access link" },
    };
  }

  if (tokenRecord.expiresAt < new Date()) {
    return { error: { code: 400, message: "Link expired" } };
  }

  if (
    applicationId &&
    tokenRecord.loanApplicationId &&
    tokenRecord.loanApplicationId !== applicationId
  ) {
    // Invite tokens are created for one loan, but the same client may open
    // sibling applications from the portal list. Allow same-client access.
    const email = await resolveUploadTokenClientEmail(
      prisma,
      tokenRecord.clientId,
    );
    const clientIds = await resolvePortalClientIds(prisma, {
      clientId: tokenRecord.clientId,
      email,
    });
    const siblingApp = await prisma.loanApplication.findFirst({
      where: {
        id: applicationId,
        clientId: { in: clientIds.length > 0 ? clientIds : [tokenRecord.clientId] },
      },
      select: { id: true, clientId: true },
    });

    if (!siblingApp) {
      return { error: { code: 403, message: "Access denied" } };
    }

    return {
      clientId: siblingApp.clientId,
      applicationId: siblingApp.id,
      email: email || undefined,
    };
  }

  return {
    clientId: tokenRecord.clientId,
    applicationId: applicationId || tokenRecord.loanApplicationId,
  };
}

module.exports = {
  getClientFromRequest,
  resolvePortalClientIds,
  resolveClientPortalAccess,
};
