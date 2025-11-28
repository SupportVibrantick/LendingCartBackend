const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { adminLogs } = require("../../../services/logger/contextLogger.js");
const { createBrokerSchema } = require("../../../schemas/admin/brokers/create.schema.js");
const bcrypt = require("bcrypt");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function createBrokerRoutes(fastify) {
  fastify.post("/", async (request, reply) => {
    try {
      // Validate with Zod
      const validation = createBrokerSchema.safeParse(request.body);

      if (!validation.success) {
        adminLogs.error("Invalid broker creation payload", validation.error);

        return reply.status(400).send({
          success: false,
          message: "Invalid input data for creating broker.",
          details: process.env.NODE_ENV === "development" ? validation.error.issues : undefined,
        });
      }

      const {
        organizationName,
        organizationEmail,
        organizationPhone,
        adminFirstName,
        adminLastName,
        adminEmail,
        adminPassword,
      } = validation.data;

      // Check duplicate organization
      const existingOrg = await prisma.organization.findFirst({
        where: {
          OR: [
            { name: organizationName },
            { email: organizationEmail },
            { phone: organizationPhone }
          ]
        },
      });

      if (existingOrg) {
        return reply.status(409).send({
          success: false,
          message: "Organization with provided details already exists.",
        });
      }

      // Check duplicate admin user email
      const existingUser = await prisma.userAccount.findFirst({
        where: { email: adminEmail },
      });

      if (existingUser) {
        return reply.status(409).send({
          success: false,
          message: "Admin email already in use.",
        });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(adminPassword, 10);

      let newOrganization;
      let newAdmin;

      await prisma.$transaction(async (tx) => {
        // Create Organization
        newOrganization = await tx.organization.create({
          data: {
            name: organizationName,
            type: "BROKER",
            status: "ACTIVE",
            email: organizationEmail,
            phone: organizationPhone,
          },
        });

        // Create Admin User
        newAdmin = await tx.userAccount.create({
          data: {
            organizationId: newOrganization.id,
            email: adminEmail,
            passwordHash,
            firstName: adminFirstName,
            lastName: adminLastName,
            status: "ACTIVE",
          },
        });

        // Assign BROKER_ADMIN role
        const role = await tx.role.findFirst({ where: { name: "BROKER_ADMIN" } });
        if (!role) throw new Error("BROKER_ADMIN role missing");

        await tx.userRole.create({
          data: {
            userId: newAdmin.id,
            roleId: role.id,
          },
        });
      });

      adminLogs.info("Broker organization created", {
        organizationId: newOrganization.id,
        adminUserId: newAdmin.id,
      });

      return reply.status(201).send({
        success: true,
        message: "Broker created successfully.",
        data: {
          organizationId: newOrganization.id,
          adminUserId: newAdmin.id,
        },
      });

    } catch (error) {
      adminLogs.error("Broker creation failed", error);

      return reply.status(500).send({
        success: false,
        message: "Server error occurred while creating broker.",
        details: process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  });
}

module.exports = createBrokerRoutes;
