const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function brokerLoginRoutes(fastify) {
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Broker -> Auth"],
        summary: "Broker login (Admin & Loan Officer)",
        description:
          "Authenticate Broker Admin or Broker Loan Officer",
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 8 },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        const email = req.body.email.trim().toLowerCase();
        const { password } = req.body;

        /* =====================================================
           1️⃣ FIND USER (Case-insensitive)
        ===================================================== */

        const user = await prisma.userAccount.findFirst({
          where: {
            email: {
              equals: email,
              mode: "insensitive",
            },
          },
          include: {
            organization: true,
            roles: {
              include: { role: true },
            },
          },
        });

        if (!user) {
          return reply.code(401).send({
            success: false,
            message: "Invalid email or password",
          });
        }

        /* =====================================================
           2️⃣ USER STATUS CHECK
        ===================================================== */

        if (user.status !== "ACTIVE") {
          return reply.code(401).send({
            success: false,
            message: "User account is inactive",
          });
        }

        /* =====================================================
           3️⃣ ORGANIZATION VALIDATION
        ===================================================== */

        if (
          !user.organization ||
          user.organization.type !== "BROKER" ||
          user.organization.status !== "ACTIVE"
        ) {
          return reply.code(401).send({
            success: false,
            message: "Invalid broker organization",
          });
        }

        /* =====================================================
           4️⃣ ROLE VALIDATION (Admin + Officer allowed)
        ===================================================== */

        const roles = user.roles.map((r) => r.role.name);

        const allowedRoles = [
          "BROKER_ADMIN",
          "BROKER_OFFICER",
        ];

        const hasAccess = roles.some((role) =>
          allowedRoles.includes(role)
        );

        if (!hasAccess) {
          return reply.code(403).send({
            success: false,
            message: "Access denied",
          });
        }

        /* =====================================================
           5️⃣ PASSWORD VALIDATION
        ===================================================== */

        const isValidPassword = await bcrypt.compare(
          password,
          user.passwordHash
        );

        if (!isValidPassword) {
          return reply.code(401).send({
            success: false,
            message: "Invalid email or password",
          });
        }

        /* =====================================================
           6️⃣ GENERATE JWT
        ===================================================== */

        const token = jwt.sign(
          {
            id: user.id,
            organizationId: user.organizationId,
            orgType: "BROKER",
            roles,
          },
          process.env.JWT_SECRET,
          {
            expiresIn: "24h",
            issuer: "lendingcart",
            audience: "broker-app",
          }
        );

        /* =====================================================
           7️⃣ UPDATE LAST LOGIN
        ===================================================== */

        await prisma.userAccount.update({
          where: { id: user.id },
          data: {
            lastLoginAt: new Date(),
          },
        });

        /* =====================================================
           8️⃣ SUCCESS RESPONSE
        ===================================================== */

        return reply.send({
          success: true,
          message: "Login successful",
          data: {
            token,
            user: {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              organizationId: user.organizationId,
              organizationName: user.organization.name,
              roles,
            },
          },
        });
      } catch (error) {
        fastify.log.error(
          { error: error.message },
          "Broker login error"
        );

        return reply.code(500).send({
          success: false,
          message: "Server error during login",
        });
      }
    }
  );
}

module.exports = brokerLoginRoutes;