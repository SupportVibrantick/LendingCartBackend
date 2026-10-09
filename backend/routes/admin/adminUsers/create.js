const fp = require("fastify-plugin");
const bcrypt = require("bcrypt");
const {
  createAdminUserSchema,
} = require("../../../schemas/admin/adminUsers/create.schema.js");
const {
  syncUserPermissions,
  filterValidAdminPermissionKeys,
  filterDelegatablePermissionKeys,
  getPlatformAdminAccessContext,
} = require("../../../services/auth/adminUserPermissions.js");
const { adminLogs } = require("../../../services/logger/contextLogger.js");
const {
  sendAdminCredentialsEmail,
} = require("../../../services/emails/adminCredentialsEmail.js");

module.exports = fp(async function createAdminUserRoutes(fastify) {
  fastify.post(
    "/create",
    {
      preHandler: [
        fastify.authenticate,
        fastify.verifySuperAdmin,
        fastify.requirePermission(["MANAGE_PERMISSIONS", "CREATE_USER"]),
      ],
    },
    async (request, reply) => {
      const prisma = fastify.prisma;
      const parsed = createAdminUserSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          success: false,
          message: "Validation failed",
          errors: parsed.error.flatten(),
        });
      }

      let {
        organizationId,
        firstName,
        lastName,
        email,
        password,
        accessLevel,
        permissions,
      } = parsed.data;

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

      const requestedKeys = filterValidAdminPermissionKeys(permissions || []);
      if (
        accessLevel === "CUSTOM" &&
        (permissions || []).some((key) => !requestedKeys.includes(key))
      ) {
        return reply.code(400).send({
          success: false,
          message: "One or more permission keys are invalid",
        });
      }

      const finalPermissions =
        accessLevel === "CUSTOM"
          ? filterDelegatablePermissionKeys(
              requestedKeys,
              actorAccess.permissionKeys,
              actorAccess.hasFullAccess,
            )
          : [];

      if (accessLevel === "CUSTOM" && finalPermissions.length === 0) {
        return reply.code(400).send({
          success: false,
          message: actorAccess.hasFullAccess
            ? "Select at least one permission for custom access"
            : "You can only assign permissions you already hold",
        });
      }

      if (
        accessLevel === "CUSTOM" &&
        finalPermissions.length !== requestedKeys.length
      ) {
        return reply.code(403).send({
          success: false,
          message: "Cannot grant permissions you do not hold",
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
          return reply
            .code(409)
            .send({ success: false, message: "Email already exists" });
        }

        const roleRecord = await prisma.role.findFirst({
          where: { name: "PLATFORM_ADMIN" },
        });

        if (!roleRecord) {
          return reply
            .code(500)
            .send({ success: false, message: "PLATFORM_ADMIN role missing" });
        }

        const newAdmin = await prisma.$transaction(async (tx) => {
          const user = await tx.userAccount.create({
            data: {
              organizationId,
              firstName,
              lastName,
              email,
              passwordHash: await bcrypt.hash(password, 12),
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
            await syncUserPermissions(tx, user.id, finalPermissions);
          }

          return user;
        });

        adminLogs.info("Admin user created", {
          actorId,
          userId: newAdmin.id,
          accessLevel,
          permissionCount:
            accessLevel === "CUSTOM" ? finalPermissions.length : "ALL",
        });

        let emailQueued = false;
        try {
          await sendAdminCredentialsEmail({
            prisma,
            firstName,
            lastName,
            email,
            password,
            accessLevel,
          });
          emailQueued = true;
          adminLogs.info("Admin credentials email enqueued", {
            to: email,
            userId: newAdmin.id,
          });
        } catch (mailErr) {
          adminLogs.error(
            "Admin created but credentials email failed",
            mailErr,
          );
        }

        return reply.code(201).send({
          success: true,
          message: emailQueued
            ? "Admin created successfully. Login credentials have been emailed."
            : "Admin created successfully, but the credentials email could not be sent.",
          emailQueued,
          user: {
            id: newAdmin.id,
            firstName,
            lastName,
            email,
            organizationId,
            accessLevel,
            permissions: accessLevel === "FULL" ? ["*"] : finalPermissions,
          },
        });
      } catch (err) {
        request.log.error(err);
        return reply
          .code(500)
          .send({ success: false, message: "Internal server error" });
      }
    },
  );
});
