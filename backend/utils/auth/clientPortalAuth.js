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
  resolveClientPortalAccess,
};
