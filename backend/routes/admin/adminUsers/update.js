const fp = require("fastify-plugin");
const { updateAdminUserSchema } = require("../../../schemas/admin/adminUsers/update.schema.js");
const {
  syncUserPermissions,
  ALL_ADMIN_PERMISSION_KEYS,
  resolveUserPermissions,
} = require("../../../services/auth/adminUserPermissions.js");

module.exports = fp(async function updateAdminUserRoutes(fastify) {
  fastify.put("/update/:id", {
    preHandler: [fastify.authenticate, fastify.verifySuperAdmin],
  }, async (request, reply) => {
    const prisma = fastify.prisma;
    const { id } = request.params;

    const parsed = updateAdminUserSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        message: "Validation failed",
        errors: parsed.error.flatten(),
      });
    }

    const { firstName, lastName, email, accessLevel, permissions } = parsed.data;

    if (permissions) {
      const invalidKeys = permissions.filter(
        (key) => !ALL_ADMIN_PERMISSION_KEYS.includes(key)
      );
      if (invalidKeys.length > 0) {
        return reply.code(400).send({
          success: false,
          message: `Invalid permission keys: ${invalidKeys.join(", ")}`,
        });
      }
    }

    try {
      const existing = await prisma.userAccount.findFirst({
        where: {
          id,
          roles: { some: { role: { name: "PLATFORM_ADMIN" } } },
        },
      });

      if (!existing) {
        return reply.code(404).send({ success: false, message: "Admin user not found" });
      }

      if (email && email !== existing.email) {
        const emailTaken = await prisma.userAccount.findUnique({ where: { email } });
        if (emailTaken) {
          return reply.code(409).send({ success: false, message: "Email already exists" });
        }
      }

      const updated = await prisma.$transaction(async (tx) => {
        const user = await tx.userAccount.update({
          where: { id },
          data: {
            ...(firstName !== undefined && { firstName }),
            ...(lastName !== undefined && { lastName }),
            ...(email !== undefined && { email }),
          },
        });

        if (accessLevel === "FULL") {
          await tx.userPermission.deleteMany({ where: { userId: id } });
        } else if (accessLevel === "CUSTOM" && permissions) {
          await syncUserPermissions(tx, id, permissions);
        } else if (permissions) {
          await syncUserPermissions(tx, id, permissions);
        }

        return user;
      });

      const roleNames = ["PLATFORM_ADMIN"];
      const effectivePermissions = await resolveUserPermissions(prisma, id, roleNames);
      const hasCustom = await prisma.userPermission.count({ where: { userId: id } });

      return reply.send({
        success: true,
        message: "Admin updated successfully",
        user: {
          id: updated.id,
          firstName: updated.firstName,
          lastName: updated.lastName,
          email: updated.email,
          accessLevel: hasCustom > 0 ? "CUSTOM" : "FULL",
          permissions: hasCustom > 0 ? effectivePermissions : ["*"],
        },
      });
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ success: false, message: "Internal server error" });
    }
  });
});
