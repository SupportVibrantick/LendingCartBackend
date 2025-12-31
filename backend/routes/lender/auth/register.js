const bcrypt = require("bcrypt");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function lenderRegisterRoutes(fastify) {
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Lender -> Auth"],
        summary: "Lender self registration",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const {
        organizationName,
        organizationEmail,
        adminFirstName,
        adminLastName,
        adminEmail,
        password,
      } = req.body;

      if (
        !organizationName ||
        !organizationEmail ||
        !adminEmail ||
        !password
      ) {
        return reply.status(400).send({
          success: false,
          message: "Missing required fields",
        });
      }

      // Duplicate org
      const orgExists = await prisma.organization.findFirst({
        where: {
          OR: [
            { name: organizationName },
            { email: organizationEmail },
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
        where: { email: adminEmail },
      });

      if (userExists) {
        return reply.status(409).send({
          success: false,
          message: "Email already registered",
        });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      let lenderOrg, adminUser;

      await prisma.$transaction(async (tx) => {
        lenderOrg = await tx.organization.create({
          data: {
            name: organizationName,
            email: organizationEmail,
            type: "LENDER",
            status: "ACTIVE", // or PENDING_APPROVAL if you want
          },
        });

        adminUser = await tx.userAccount.create({
          data: {
            organizationId: lenderOrg.id,
            email: adminEmail,
            passwordHash,
            firstName: adminFirstName,
            lastName: adminLastName,
            status: "ACTIVE",
          },
        });

        const role = await tx.role.findFirst({
          where: { name: "LENDER_ADMIN" },
        });

        if (!role) throw new Error("LENDER_ADMIN role missing");

        await tx.userRole.create({
          data: {
            userId: adminUser.id,
            roleId: role.id,
          },
        });
      });

      return reply.status(201).send({
        success: true,
        message: "Lender registered successfully",
        data: {
          organizationId: lenderOrg.id,
          adminUserId: adminUser.id,
        },
      });
    }
  );
}

module.exports = lenderRegisterRoutes;
