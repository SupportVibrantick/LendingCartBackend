const fp = require("fastify-plugin");
const {
  updateAdminUserSchema,
} = require("../../../schemas/admin/adminUsers/update.schema.js");
const {
  syncUserPermissions,
  resolveUserPermissions,
  filterValidAdminPermissionKeys,
  filterDelegatablePermissionKeys,
  getPlatformAdminAccessContext,
} = require("../../../services/auth/adminUserPermissions.js");
const { adminLogs } = require("../../../services/logger/contextLogger.js");

module.exports = fp(async function updateAdminUserRoutes(fastify) {
  fastify.put(
    "/update/:id",
    {
      preHandler: [
        fastify.authenticate,
        fastify.verifySuperAdmin,
        fastify.requirePermission(["MANAGE_PERMISSIONS", "UPDATE_USER"]),
      ],
    },
    async (request, reply) => {
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

      const { firstName, lastName, email, accessLevel, permissions } =
        parsed.data;

      const actorId = request.user?.userId || request.user?.id;
      const actorRoles = Array.isArray(request.user?.roles)
        ? request.user.roles
        : [];
      const actorAccess = await getPlatformAdminAccessContext(
        prisma,
        actorId,
        actorRoles,
      );

      if (accessLevel === "FULL" && !actorAccess.hasFullAccess) {
        return reply.code(403).send({
          success: false,
          message: "Only full-access administrators can grant Full Access",
        });
      }

      let finalPermissions;
      if (permissions) {
        const requestedKeys = filterValidAdminPermissionKeys(permissions);
        if (permissions.some((key) => !requestedKeys.includes(key))) {
          return reply.code(400).send({
            success: false,
            message: "One or more permission keys are invalid",
          });
        }

        finalPermissions = filterDelegatablePermissionKeys(
          requestedKeys,
          actorAccess.permissionKeys,
          actorAccess.hasFullAccess,
        );

        if (
          accessLevel === "CUSTOM" &&
          finalPermissions.length !== requestedKeys.length
        ) {
          return reply.code(403).send({
            success: false,
            message: "Cannot grant permissions you do not hold",
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
          return reply
            .code(404)
            .send({ success: false, message: "Admin user not found" });
        }

        if (email && email !== existing.email) {
          const emailTaken = await prisma.userAccount.findUnique({
            where: { email },
          });
          if (emailTaken) {
            return reply
              .code(409)
              .send({ success: false, message: "Email already exists" });
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
          } else if (accessLevel === "CUSTOM" && finalPermissions) {
            if (finalPermissions.length === 0) {
              throw Object.assign(new Error("CUSTOM_EMPTY"), {
                code: "CUSTOM_EMPTY",
              });
            }
            await syncUserPermissions(tx, id, finalPermissions);
          } else if (finalPermissions) {
            await syncUserPermissions(tx, id, finalPermissions);
          }

          return user;
        });

        const roleNames = ["PLATFORM_ADMIN"];
        const effectivePermissions = await resolveUserPermissions(
          prisma,
          id,
          roleNames,
        );
        const hasCustom = await prisma.userPermission.count({
          where: { userId: id },
        });

        adminLogs.info("Admin user updated", {
          actorId,
          userId: id,
          accessLevel: hasCustom > 0 ? "CUSTOM" : "FULL",
        });

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
        if (err?.code === "CUSTOM_EMPTY") {
          return reply.code(400).send({
            success: false,
            message: "Select at least one permission for custom access",
          });
        }
        request.log.error(err);
        return reply
          .code(500)
          .send({ success: false, message: "Internal server error" });
      }
    },
  );
});
