const fp = require("fastify-plugin");
const bcrypt = require("bcrypt");
const { createAdminUserSchema } = require("../../../schemas/admin/adminUsers/create.schema.js");
const {
  syncUserPermissions,
  ALL_ADMIN_PERMISSION_KEYS,
} = require("../../../services/auth/adminUserPermissions.js");
const { adminLogs } = require("../../../services/logger/contextLogger.js");

module.exports = fp(async function createAdminUserRoutes(fastify) {
  fastify.post("/create", {
    preHandler: [fastify.authenticate, fastify.verifySuperAdmin],
  }, async (request, reply) => {
    const prisma = fastify.prisma;
    const parsed = createAdminUserSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        message: "Validation failed",
        errors: parsed.error.flatten(),
      });
    }

    let { organizationId, firstName, lastName, email, password, accessLevel, permissions } =
      parsed.data;

    const invalidKeys = (permissions || []).filter(
      (key) => !ALL_ADMIN_PERMISSION_KEYS.includes(key)
    );
    if (invalidKeys.length > 0) {
      return reply.code(400).send({
        success: false,
        message: `Invalid permission keys: ${invalidKeys.join(", ")}`,
      });
    }

    try {
      if (!organizationId) {
        const platformOrg = await prisma.organization.findFirst({
          where: { type: "PLATFORM", status: "ACTIVE" },
        });

        if (!platformOrg) {
          return reply.code(500).send({
            success: false,
            message: "Platform organization missing. Seed first.",
          });
        }

        organizationId = platformOrg.id;
      }

      const exists = await prisma.userAccount.findUnique({ where: { email } });
      if (exists) {
        return reply.code(409).send({ success: false, message: "Email already exists" });
      }

      const roleRecord = await prisma.role.findFirst({
        where: { name: "PLATFORM_ADMIN" },
      });

      if (!roleRecord) {
        return reply.code(500).send({ success: false, message: "PLATFORM_ADMIN role missing" });
      }

      const newAdmin = await prisma.$transaction(async (tx) => {
        const user = await tx.userAccount.create({
          data: {
            organizationId,
            firstName,
            lastName,
            email,
            passwordHash: await bcrypt.hash(password, 10),
            status: "ACTIVE",
          },
        });

        await tx.userRole.create({
          data: {
            userId: user.id,
            roleId: roleRecord.id,
          },
        });

        if (accessLevel === "CUSTOM") {
          await syncUserPermissions(tx, user.id, permissions);
        }

        return user;
      });

      adminLogs.info("Admin user created", {
        userId: newAdmin.id,
        accessLevel,
        permissionCount: accessLevel === "CUSTOM" ? permissions.length : "ALL",
      });

      return reply.code(201).send({
        success: true,
        message: "Admin created successfully",
        user: {
          id: newAdmin.id,
          firstName,
          lastName,
          email,
          organizationId,
          accessLevel,
          permissions: accessLevel === "FULL" ? ["*"] : permissions,
        },
      });
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ success: false, message: "Internal server error" });
    }
  });
});
