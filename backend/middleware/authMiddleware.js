// backend/middleware/authMiddleware.js
const fp = require("fastify-plugin");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const jwtSecret = require("../utils/auth/jwtSecret");
const logger = require("../services/logger/contextLogger");

function registerAuthMiddleware(fastify, opts, done) {
  fastify.decorate("authenticate", async function (request, reply) {
    try {
      const authHeader = request.headers["authorization"] || "";
      const header = String(authHeader).trim();
      const token = header.startsWith("Bearer ")
        ? header.slice(7).trim()
        : header || null;

      if (!token) {
        logger.commonLogs.error("No token provided", {
          endpoint: request.url,
          method: request.method,
        });
        return reply.code(401).send({ ok: false, message: "No token provided" });
      }

      const decoded = jwt.verify(token, jwtSecret);

      //  Normalize payload (BACKWARD COMPATIBLE)
      const userId =
        decoded.userId ??
        decoded.id ??
        decoded.user?.id ??
        null;

      const organizationId =
        decoded.organizationId ??
        decoded.orgId ??
        decoded.organization?.id ??
        null;

      const orgType =
        decoded.orgType ??
        decoded.organization?.type ??
        null;

      const roles =
        decoded.roles ??
        decoded.role ??
        [];

      if (!userId) {
        logger.commonLogs.warn("Token missing user id", {
          endpoint: request.url,
          method: request.method,
        });
        return reply.code(401).send({ ok: false, message: "Invalid token payload" });
      }

      // DO NOT REMOVE OLD KEYS (super-admin safety)
request.user = {
  // IDs
  userId,
  id: userId,

  clientId:
    decoded.clientId ??
    decoded.client?.id ??
    null,

  // organization
  orgId: organizationId,
  organizationId,

  orgType,

  // roles
  roles,
  role: decoded.role ?? null,

  // 🔥 IMPORTANT
  email:
    decoded.email ??
    decoded.user?.email ??
    decoded.clientEmail ??
    null,

  clientEmail:
    decoded.clientEmail ??
    decoded.email ??
    null,

  impersonatedBy:
    decoded.impersonatedBy ?? null,

  raw: decoded,
};
    } catch (err) {
      logger.commonLogs.error("Invalid or expired token", {
        endpoint: request.url,
        method: request.method,
        error: err?.message || err,
      });
      return reply.code(401).send({ ok: false, message: "Invalid or expired token" });
    }
  });

  fastify.decorate("requireRole", (allowedRoles = []) => {
    return async (request, reply) => {
      const userRoles = request.user?.roles ?? [];
      const hasAccess = Array.isArray(userRoles)
        ? userRoles.some((r) => allowedRoles.includes(r))
        : allowedRoles.includes(userRoles);

      if (!hasAccess) {
        logger.commonLogs.warn("Access denied - role", {
          endpoint: request.url,
          method: request.method,
          userRoles,
          allowedRoles,
        });
        return reply
          .code(403)
          .send({ ok: false, message: "Forbidden - insufficient role" });
      }
    };
  });

  done();
}

module.exports = fp(registerAuthMiddleware, { name: "auth-middleware" });
