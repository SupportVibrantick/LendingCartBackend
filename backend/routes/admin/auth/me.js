// backend/routes/admin/auth/me.js
const prisma = require("../../../config/prisma.js");
const { getUserRolesFromFGA } = require("../../../services/auth/fgaService.js");
const { resolveUserPermissions } = require("../../../services/auth/adminUserPermissions.js");

module.exports = async function adminMeRoute(fastify, opts) {
  // safe wrapper that calls fastify.authenticate if available, otherwise returns 500
  const safeAuthPreHandler = async (req, reply) => {
    if (typeof fastify.authenticate !== "function") {
      fastify.log.error("Auth middleware not registered: fastify.authenticate is missing");
      return reply.code(500).send({ ok: false, message: "Server misconfiguration: auth middleware missing" });
    }

    // call the actual authenticate decorator
    // If authenticate sends a reply (401), it ends the request lifecycle automatically.
    return fastify.authenticate(req, reply);
  };

  fastify.get(
    "/me",
    { preHandler: [safeAuthPreHandler] },
    async (req, reply) => {
      try {
        // authenticate should attach request.user with userId
        const userId = req.user && (req.user.userId || req.user.id);
        if (!userId) {
          return reply.code(401).send({ ok: false, message: "Unauthorized" });
        }

        // fetch user from DB
        const user = await prisma.userAccount.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            profileImage: true,
            status: true,
            organizationId: true,
            roles: { include: { role: true } },
            lastLoginAt: true,
            createdAt: true,
          },
        });

        if (!user) {
          return reply.code(404).send({ ok: false, message: "User not found" });
        }

        const dbRoles = user.roles?.map((r) => r.role?.name).filter(Boolean) ?? [];

        let permissions = [];
        try {
          permissions = await resolveUserPermissions(prisma, user.id, dbRoles);
        } catch (err) {
          fastify.log.warn("resolveUserPermissions failed for /me", {
            userId: user.id,
            err: err && err.message ? err.message : err,
          });
        }

        const customPermCount = await prisma.userPermission.count({
          where: { userId: user.id },
        });

        // best-effort: fetch FGA roles (may throw, so catch below)
        let fgaRoles = [];
        try {
          fgaRoles = await getUserRolesFromFGA(user.id);
        } catch (err) {
          fastify.log.warn("getUserRolesFromFGA failed for /me", { userId: user.id, err: err && err.message ? err.message : err });
          fgaRoles = [];
        }

        return reply.send({
          ok: true,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone,
            profileImage: user.profileImage,
            status: user.status,
            organizationId: user.organizationId,
            dbRoles,
            fgaRoles,
            permissions,
            hasFullAccess: dbRoles.includes("PLATFORM_ADMIN") && customPermCount === 0,
            lastLoginAt: user.lastLoginAt,
            createdAt: user.createdAt
          }
        });
      } catch (err) {
        fastify.log.error("Error in /admin/auth/me handler", { err: err && err.message ? err.message : err });
        return reply.code(500).send({ ok: false, message: "Server error" });
      }
    }
  );
};
