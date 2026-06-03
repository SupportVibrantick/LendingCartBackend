const bcrypt = require("bcrypt");

const {
  brokerRegisterSchema,
} = require("../../../schemas/broker/auth/register.schema");

const { commonLogs } = require(
  "../../../services/logger/contextLogger"
);

/**
 * Broker self-register (creates BROKER org + admin user)
 * @param {import("fastify").FastifyInstance} fastify
 */
async function brokerRegisterRoutes(fastify) {
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Broker -> Auth"],
        summary: "Broker self registration",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        const parsed = brokerRegisterSchema.safeParse(req.body);
        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            message: "Invalid registration payload",
            // optional for dev:
            // errors: parsed.error.issues,
          });
        }

        let {
          organizationName,
          organizationEmail,
          organizationPhone,
          firstName,
          lastName,
          email,
          password,
        } = parsed.data;

        // Normalize
        organizationEmail = organizationEmail.trim().toLowerCase();
        email = email.trim().toLowerCase();

        // Duplicate org
        const orgExists = await prisma.organization.findFirst({
          where: {
            OR: [
              { name: organizationName },
              { email: organizationEmail },
              { phone: String(organizationPhone) },
            ],
          },
        });

        if (orgExists) {
          return reply.status(409).send({
            success: false,
            message: "Organization already exists",
          });
        }

        // Duplicate user
        const userExists = await prisma.userAccount.findFirst({
          where: {
            email: { equals: email, mode: "insensitive" },
          },
        });

        if (userExists) {
          return reply.status(409).send({
            success: false,
            message: "Email already registered",
          });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        let brokerOrg;
        let brokerAdmin;

        await prisma.$transaction(async (tx) => {
          brokerOrg = await tx.organization.create({
            data: {
              name: organizationName,
              email: organizationEmail,
              phone: String(organizationPhone),
              type: "BROKER",
              status: "ACTIVE",
            },
          });

          brokerAdmin = await tx.userAccount.create({
            data: {
              organizationId: brokerOrg.id,
              email,
              passwordHash,
              firstName,
              lastName,
              status: "ACTIVE",
            },
          });

          const role = await tx.role.findFirst({
            where: { name: "BROKER_ADMIN" },
          });

          if (!role) throw new Error("BROKER_ADMIN role missing");

          await tx.userRole.create({
            data: {
              userId: brokerAdmin.id,
              roleId: role.id,
            },
          });
        });

        commonLogs.info("Broker self-registered", {
          organizationId: brokerOrg.id,
          userId: brokerAdmin.id,
        });

        return reply.status(201).send({
          success: true,
          message: "Broker registered successfully",
        });
      } catch (err) {
        commonLogs.error("Broker register failed", err);
        return reply.status(500).send({
          success: false,
          message: err.message || "Server error during registration",
        });
      }
    }
  );
}

module.exports = brokerRegisterRoutes;
