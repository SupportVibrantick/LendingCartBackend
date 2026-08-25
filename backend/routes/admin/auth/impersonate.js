const jwt = require("jsonwebtoken");
const jwtSecret = require("../../../utils/auth/jwtSecret");
const { adminLogs } = require("../../../services/logger/contextLogger");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function impersonateRoute(fastify) {
  fastify.post(
    "/impersonate",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "15 minute",
          errorResponseBuilder: (request, context) => {
            return {
              statusCode: 429,
              error: "Too Many Requests",
              success: false,
              message:
                "Too many login attempts. Please try again after 15 minutes.",
            };
          },
        },
      },
      schema: {
        tags: ["Admin -> Auth"],
        summary: "Impersonate broker or lender portal",
        body: {
          type: "object",
          required: ["organizationId"],
          properties: {
            organizationId: { type: "string", format: "uuid" },
            reason: { type: "string" },
          },
        },
      },
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const prisma = fastify.prisma;

      try {
        const { organizationId, reason } = request.body;
        const adminUserId = request.user.userId;

        /* ===================================================
           Prevent nested impersonation
        =================================================== */
        if (request.user.impersonatedBy) {
          return reply.status(400).send({
            success: false,
            message: "Already in impersonation mode",
          });
        }

        /* ===================================================
            Check PLATFORM_ADMIN role
        =================================================== */
        const isPlatformAdmin = await prisma.userRole.findFirst({
          where: {
            userId: adminUserId,
            role: { name: "PLATFORM_ADMIN" },
          },
        });

        if (!isPlatformAdmin) {
          return reply.status(403).send({
            success: false,
            message: "Access denied",
          });
        }

        /* ===================================================
          Find Organization
        =================================================== */
        const organization = await prisma.organization.findFirst({
          where: {
            id: organizationId,
            isDeleted: false,
          },
        });

        if (!organization) {
          return reply.status(404).send({
            success: false,
            message: "Organization not found",
          });
        }

        /* ===================================================
          Determine Admin Role Type
        =================================================== */
        let adminRoleName;

        if (organization.type === "BROKER") {
          adminRoleName = "BROKER_ADMIN";
        } else if (organization.type === "LENDER") {
          adminRoleName = "LENDER_ADMIN";
        } else {
          return reply.status(400).send({
            success: false,
            message: "Impersonation not allowed for this organization type",
          });
        }

        /* ===================================================
           Fetch Target Admin (WITH Organization)
        =================================================== */
        const targetAdmin = await prisma.userAccount.findFirst({
          where: {
            organizationId: organization.id,
            status: "ACTIVE",
            roles: {
              some: {
                role: { name: adminRoleName },
              },
            },
          },
          include: {
            roles: {
              include: { role: true },
            },
            organization: true,
          },
        });

        if (!targetAdmin) {
          return reply.status(404).send({
            success: false,
            message: "No active admin found for this organization",
          });
        }

        const roleNames = targetAdmin.roles.map((r) => r.role.name);

        /* ===================================================
      Extra Safety: Prevent impersonating PLATFORM_ADMIN
        =================================================== */
        if (roleNames.includes("PLATFORM_ADMIN")) {
          return reply.status(403).send({
            success: false,
            message: "Cannot impersonate PLATFORM_ADMIN",
          });
        }

        /* ===================================================
         Generate Secure Impersonation JWT
        =================================================== */
        const token = jwt.sign(
          {
            id: targetAdmin.id,
            organizationId: targetAdmin.organizationId,
            orgType: organization.type,
            roles: roleNames,
            impersonatedBy: adminUserId,
          },
          jwtSecret,
          {
            expiresIn: "2h",
            issuer: "lending-platform",
            audience: "portal",
          },
        );

        /* ===================================================
           Audit Logging
        =================================================== */
        adminLogs.info("Impersonation successful", {
          superAdminId: adminUserId,
          targetOrgId: organization.id,
          targetUserId: targetAdmin.id,
          orgType: organization.type,
          reason: reason || "not_provided",
          ip: request.ip,
        });

        /* ===================================================
        Return Token + User Data
        =================================================== */
        return reply.send({
          success: true,
          token,
          user: {
            id: targetAdmin.id,
            email: targetAdmin.email,
            name: `${targetAdmin.firstName} ${targetAdmin.lastName}`,
            organizationId: targetAdmin.organizationId,
            organizationName: targetAdmin.organization.name,
            roles: roleNames,
            organizationType: organization.type,
          },
          redirectTo:
            organization.type === "BROKER"
              ? "/broker/dashboard"
              : "/lender/dashboard",
        });
      } catch (error) {
        adminLogs.error("Impersonation failed", error);

        return reply.status(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    },
  );
}

module.exports = impersonateRoute;
