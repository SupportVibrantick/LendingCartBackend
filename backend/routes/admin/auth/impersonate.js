const jwt = require("jsonwebtoken");
const { adminLogs } = require("../../../services/logger/contextLogger");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function impersonateRoute(fastify) {
  fastify.post(
    "/impersonate",
    {
      schema: {
        tags: ["Admin -> Auth"],
        summary: "Impersonate broker or lender portal",
        body: {
          type: "object",
          required: ["organizationId"],
          properties: {
            organizationId: { type: "string", format: "uuid" },
            reason: { type: "string" } // optional but recommended
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
           🚫 0️⃣ Prevent nested impersonation
        =================================================== */
        if (request.user.impersonatedBy) {
          return reply.status(400).send({
            success: false,
            message: "Already in impersonation mode",
          });
        }

        /* ===================================================
           ✅ 1️⃣ Check PLATFORM_ADMIN
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
           ✅ 2️⃣ Find organization
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
           ✅ 3️⃣ Determine required admin role
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
           ✅ 4️⃣ Fetch target admin with roles included
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
          },
        });

        if (!targetAdmin) {
          return reply.status(404).send({
            success: false,
            message: "No active admin found for this organization",
          });
        }

        const roleNames = targetAdmin.roles.map(r => r.role.name);

        /* ===================================================
           🚫 5️⃣ Prevent impersonating PLATFORM_ADMIN
        =================================================== */
        if (roleNames.includes("PLATFORM_ADMIN")) {
          return reply.status(403).send({
            success: false,
            message: "Cannot impersonate PLATFORM_ADMIN",
          });
        }

        /* ===================================================
           🔐 6️⃣ Generate secure impersonation JWT
        =================================================== */
        const token = jwt.sign(
          {
            userId: targetAdmin.id,
            organizationId: organization.id,
            organizationType: organization.type,
            roles: roleNames,
            impersonatedBy: adminUserId,
          },
          process.env.JWT_SECRET,
          {
            expiresIn: "2h",
            issuer: "lending-platform",
            audience: "portal",
          }
        );

        /* ===================================================
           📝 7️⃣ Audit Logging
        =================================================== */
        adminLogs.info("Impersonation successful", {
          superAdminId: adminUserId,
          targetOrgId: organization.id,
          targetUserId: targetAdmin.id,
          orgType: organization.type,
          reason: reason || "not_provided",
          ip: request.ip,
        });

        return reply.send({
          success: true,
          token,
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
    }
  );
}

module.exports = impersonateRoute;