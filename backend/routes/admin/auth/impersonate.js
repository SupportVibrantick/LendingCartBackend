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
          },
        },
      },
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const prisma = fastify.prisma;

      try {
        const { organizationId } = request.body;

        // ✅ Step 1: Check PLATFORM_ADMIN
        const platformAdmin = await prisma.userRole.findFirst({
          where: {
            userId: request.user.userId,
            role: {
              name: "PLATFORM_ADMIN",
            },
          },
        });

        if (!platformAdmin) {
          return reply.status(403).send({
            success: false,
            message: "Access denied",
          });
        }

        // ✅ Step 2: Find organization
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

        // ✅ Step 3: Determine admin role name
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

        // ✅ Step 4: Find target admin user
        const targetAdmin = await prisma.userAccount.findFirst({
          where: {
            organizationId: organization.id,
            status: "ACTIVE",
            roles: {
              some: {
                role: {
                  name: adminRoleName,
                },
              },
            },
          },
        });

        if (!targetAdmin) {
          return reply.status(404).send({
            success: false,
            message: "No active admin found for this organization",
          });
        }

        // ✅ Step 5: Generate impersonation token
        const token = jwt.sign(
          {
            userId: targetAdmin.id,
            organizationId: organization.id,
            organizationType: organization.type,
            impersonatedBy: request.user.userId,
          },
          process.env.JWT_SECRET,
          { expiresIn: "2h" }
        );

        adminLogs.info("Impersonation successful", {
          superAdminId: request.user.userId,
          targetOrgId: organization.id,
          targetUserId: targetAdmin.id,
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
          message: error.message,
        });
      }
    }
  );
}

module.exports = impersonateRoute;