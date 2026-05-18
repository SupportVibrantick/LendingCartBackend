const jwt = require("jsonwebtoken");

async function clientAuthMiddleware(req, reply) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return reply.code(401).send({
        success: false,
        message: "Unauthorized",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    //  IMPORTANT
req.user = {
  id: decoded.id,
  userId: decoded.id,

  clientId: decoded.clientId,

  email:
    decoded.email ||
    decoded.clientEmail,

  clientEmail:
    decoded.clientEmail ||
    decoded.email,

  role: decoded.role,
  roles: decoded.role,

  raw: decoded,
};

// optional backward compatibility
req.client = decoded;

  } catch (error) {
    return reply.code(401).send({
      success: false,
      message: "Invalid token",
    });
  }
}

module.exports = clientAuthMiddleware;