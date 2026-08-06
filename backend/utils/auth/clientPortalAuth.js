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

async function resolveClientPortalAccess(
  prisma,
  req,
  { applicationId } = {},
) {
  const uploadToken = req.query?.token;

  if (uploadToken) {
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
      return { error: { code: 403, message: "Access denied" } };
    }

    return {
      clientId: tokenRecord.clientId,
      applicationId: applicationId || tokenRecord.loanApplicationId,
    };
  }

  const clientAuth = getClientFromRequest(req);
  if (clientAuth.error) {
    return clientAuth;
  }

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

module.exports = {
  getClientFromRequest,
  resolvePortalClientIds,
  resolveClientPortalAccess,
};
