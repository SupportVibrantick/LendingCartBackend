const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

async function brokerLoginRoutes(fastify) {
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Broker -> Auth"],
        summary: "Broker login (Admin, Officer, Sub Broker)",
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
            userPermissions: {
              include: {
                permission: {
                  select: { key: true },
                },
              },
            },
          },
        });

        if (!user) {
          return reply.code(401).send({
            success: false,
            message: "Invalid email or password",
          });
        }

        if (user.status !== "ACTIVE") {
          return reply.code(401).send({
            success: false,
            message: "User account is inactive",
          });
        }

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

        // ✅ roles extraction
        const roles = user.roles.map((r) => r.role.name);

        const allowedRoles = [
          "BROKER_ADMIN",
          "BROKER_OFFICER",
          "SUB_BROKER",
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

        // ✅ password check
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

        // ✅ permissions extraction
        const permissions = user.userPermissions.map(
          (p) => p.permission.key
        );

        // ✅ identify user type
        const userType = roles.includes("SUB_BROKER")
          ? "SUB_BROKER"
          : "BROKER";

        // ✅ IMPORTANT FIX: parentBrokerOrgId handling
        const parentBrokerOrgId =
          userType === "SUB_BROKER"
            ? user.organizationId // 🔥 same org acts as parent
            : user.organizationId;

        // ✅ FINAL TOKEN
        const token = jwt.sign(
          {
            id: user.id,
            organizationId: user.organizationId,
            orgType: "BROKER", // org remains broker
            roles,
            permissions,
            userType,
            parentBrokerOrgId, // 🔥 FIXED
          },
          process.env.JWT_SECRET,
          {
            expiresIn: "24h",
            issuer: "lendingcart",
            audience: "broker-app",
          }
        );

        // ✅ update last login
        await prisma.userAccount.update({
          where: { id: user.id },
          data: {
            lastLoginAt: new Date(),
          },
        });

        // ✅ response
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
              permissions,
              userType,
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
          message: error.message,
        });
      }
    }
  );
}

module.exports = brokerLoginRoutes;