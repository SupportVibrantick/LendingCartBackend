const { logAuthEvent } = require("../../services/logger/auditLogger");

/**
 * Register POST /logout that records LOGOUT audit and returns success.
 * JWT sessions are client-cleared; this makes logout visible in audit logs.
 *
 * @param {import("fastify").FastifyInstance} fastify
 * @param {{ dashboard: "BROKER"|"LENDER"|"PLATFORM", preHandler?: any[] }} options
 */
function registerAuthLogoutRoute(fastify, options) {
  const { dashboard, preHandler = [] } = options;

  fastify.post(
    "/logout",
    {
      preHandler,
      schema: {
        tags: [`${dashboard} -> Auth`],
        summary: "Logout (audit)",
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const user = request.user || {};
      const userId = user.id || user.userId || null;
      const orgId = user.organizationId || user.orgId || null;

      await logAuthEvent({
        prisma: fastify.prisma,
        req: request,
        dashboard,
        action: "LOGOUT",
        status: "SUCCESS",
        actorUserId: userId,
        actorOrgId: orgId,
        email: user.email || null,
        roles: user.roles || null,
        entityId: userId,
      });

      return reply.send({
        success: true,
        message: "Logged out",
      });
    },
  );
}

module.exports = { registerAuthLogoutRoute };
