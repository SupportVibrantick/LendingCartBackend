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
        summary: "Broker login",
        description: "Authenticate broker admin user",
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

        // ---------------------------
        // Find user (case-insensitive)
        // ---------------------------
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

        // ---------------------------
        // User status check
        // ---------------------------
        if (user.status !== "ACTIVE") {
          return reply.code(401).send({
            success: false,
            message: "User account is inactive",
          });
        }

        // ---------------------------
        // Organization validation
        // ---------------------------
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

        // ---------------------------
        // Role validation
        // ---------------------------
        const roles = user.roles.map((r) => r.role.name);

        if (!roles.includes("BROKER_ADMIN")) {
          return reply.code(403).send({
            success: false,
            message: "Access denied",
          });
        }

        // ---------------------------
        // Password verification
        // ---------------------------
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

        // ---------------------------
        // Generate JWT
        // ---------------------------
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

        // ---------------------------
        // Success response
        // ---------------------------
        return reply.send({
          success: true,
          message: "Login successful",
          data: {
            token,
            user: {
              id: user.id,
              email: user.email,
              name: `${user.firstName} ${user.lastName}`,
              organizationId: user.organizationId,
              organizationName: user.organization.name,
              roles,
            },
          },
        });
      } catch (error) {
        fastify.log.error("Broker login error", error);
        return reply.code(500).send({
          success: false,
          message: "Server error during login",
        });
      }
    }
  );
}

module.exports = brokerLoginRoutes;
