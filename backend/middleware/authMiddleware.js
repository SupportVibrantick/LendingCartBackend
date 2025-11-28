// backend/middleware/authMiddleware.js
const fp = require("fastify-plugin");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const jwtSecret = process.env.JWT_SECRET || "SecretKey";
const logger = require("../services/logger/contextLogger");

function registerAuthMiddleware(fastify, opts, done) {
  fastify.decorate("authenticate", async function (request, reply) {
    try {
      const authHeader = request.headers["authorization"] || "";
      const header = String(authHeader || "").trim();
      const token = header.startsWith("Bearer ") ? header.slice(7).trim() : (header || null);

      if (!token) {
        logger.commonLogs.error("No token provided", {
          endpoint: request.url,
          method: request.method,
        });
        return reply.code(401).send({ ok: false, message: "No token provided" });
      }

      const decoded = jwt.verify(token, jwtSecret);
      
     

      const userId = decoded.userId ?? decoded.id ?? decoded.user?.id ?? null;
      const orgId = decoded.orgId ?? decoded.organizationId ?? null;
      const roles = decoded.roles ?? decoded.role ?? [];

      if (!userId) {
        logger.commonLogs.warn("Token missing user id", {
          endpoint: request.url,
          method: request.method,
        });
        return reply.code(401).send({ ok: false, message: "Invalid token payload" });
      }

      request.user = { userId, orgId, roles, raw: decoded };
    } catch (err) {
      logger.commonLogs.error("Invalid or expired token", {
        endpoint: request.url,
        method: request.method,
        error: err && err.message ? err.message : err,
      });
      return reply.code(401).send({ ok: false, message: "Invalid or expired token" });
    }
  });

  fastify.decorate("requireRole", (allowedRoles = []) => {
    return async (request, reply) => {
      const userRoles = request.user?.roles ?? [];
      const has = Array.isArray(userRoles)
        ? userRoles.some((r) => allowedRoles.includes(r))
        : allowedRoles.includes(userRoles);

        
      if (!has) {
        logger.commonLogs.warn("Access denied - role", {
          endpoint: request.url,
          method: request.method,
          userRoles,
          allowedRoles,
        });
        return reply.code(403).send({ ok: false, message: "Forbidden - insufficient role" });
      }
    };
  });

  done();
}

module.exports = fp(registerAuthMiddleware, { name: "auth-middleware" });
