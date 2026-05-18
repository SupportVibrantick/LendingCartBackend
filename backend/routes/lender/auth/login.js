const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function lenderLoginRoutes(fastify) {
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Lender -> Auth"],
        summary: "Lender login",
        description: "Authenticate lender admin or underwriter",
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
        const { email, password } = req.body;

        // ---------------------------
        // Find active lender user
        // ---------------------------
        const user = await prisma.userAccount.findFirst({
          where: {
            email,
            status: "ACTIVE",
            organization: {
              type: "LENDER",
              status: "ACTIVE",
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
          return reply.status(401).send({
            success: false,
            message: "Invalid email or password",
          });
        }

        // ---------------------------
        // Role validation
        // ---------------------------
        const roles = user.roles.map((r) => r.role.name);

        const allowedRoles = ["LENDER_ADMIN", "LENDER_UNDERWRITER"];
        const hasAccess = roles.some((r) => allowedRoles.includes(r));

        if (!hasAccess) {
          return reply.status(403).send({
            success: false,
            message: "Access denied",
          });
        }

        // ---------------------------
        // Password verification
        // ---------------------------
       console.log("LOGIN EMAIL:", email);
console.log("LOGIN PASSWORD:", password);
console.log("DB HASH:", user.passwordHash);

const isValid = await bcrypt.compare(
  password,
  user.passwordHash
);

console.log("PASSWORD MATCH:", isValid);

if (!isValid) {
  return reply.status(401).send({
    success: false,
    message: "Invalid email or password",
  });
}

        // ---------------------------
        // Issue JWT (STANDARD PAYLOAD)
        // ---------------------------
        const token = jwt.sign(
          {
            id: user.id,
            organizationId: user.organizationId,
            orgType: "LENDER",
            roles,
          },
          process.env.JWT_SECRET,
          {
            expiresIn: "24h",
            issuer: "lendingcart",
            audience: "lender-app",
          }
        );

        // ---------------------------
        // Response
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
        return reply.status(500).send({
          success: false,
          message: "Server error during login",
        });
      }
    }
  );
}

module.exports = lenderLoginRoutes;
