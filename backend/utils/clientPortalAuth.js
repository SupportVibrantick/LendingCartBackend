const jwt = require("jsonwebtoken");

function getClientFromRequest(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { error: { code: 401, message: "Unauthorized" } };
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

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

module.exports = { getClientFromRequest };
