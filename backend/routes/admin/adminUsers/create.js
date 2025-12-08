// backend/routes/admin/adminUsers/create.js
const fp = require('fastify-plugin');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();
const { createAdminUserSchema } = require('../../../schemas/admin/adminUsers/create.schema.js');
const { assignRoleToUser } = require('../../../services/fgaService.js');
const { adminLogs } = require('../../../services/logger/contextLogger.js');

module.exports = fp(async function createAdminUserRoutes(fastify) {

  fastify.post("/create", {
    preHandler: [fastify.authenticate, fastify.verifySuperAdmin],
  }, 
  async (request, reply) => {

    const parsed = createAdminUserSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: "Validation failed", errors: parsed.error.flatten() });
    }

    let { organizationId, firstName, lastName, email, password } = parsed.data;

    try {

      // 🔥 If no orgId provided, use the platform org created by seeder
      if (!organizationId) {
        const platformOrg = await prisma.organization.findFirst({
          where: { type: "PLATFORM", status: "ACTIVE" }   // Safe auto-detect
        });

        if (!platformOrg) {
          return reply.code(500).send({ message: "Platform organization missing. Seed first." });
        }

        organizationId = platformOrg.id;
      }

      const exists = await prisma.userAccount.findUnique({ where: { email } });
      if (exists) return reply.code(409).send({ message: "Email already exists" });

      const newAdmin = await prisma.userAccount.create({
        data: {
          organizationId,
          firstName,
          lastName,
          email,
          passwordHash: await bcrypt.hash(password, 10),
          status: "ACTIVE",
        },
      });

      await assignRoleToUser(newAdmin.id, "PLATFORM_ADMIN");

      adminLogs.info("Admin user created", { userId: newAdmin.id });

      return reply.code(201).send({
        message: "Admin created successfully",
        user: {
          id: newAdmin.id,
          firstName,
          lastName,
          email,
          organizationId,
        }
      });

    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ message: "Internal server error" });
    }
  });
});

