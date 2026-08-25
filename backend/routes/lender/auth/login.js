const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const jwtSecret = require("../../../utils/auth/jwtSecret");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function lenderLoginRoutes(fastify) {
  fastify.post(
    "/",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "15 minute",
          errorResponseBuilder: (request, context) => {
            return {
              statusCode: 429,
              error: "Too Many Requests",
              success: false,
              message: "Too many login attempts. Please try again after 15 minutes.",
            };
          },
        },
      },
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
        const email = String(req.body.email || "")
          .trim()
          .toLowerCase();
        const { password } = req.body;

        // ---------------------------
        // Find active lender user
        // ---------------------------
        const user = await prisma.userAccount.findFirst({
          where: {
            email: {
              equals: email,
              mode: "insensitive",
            },
            isDeleted: { not: true },
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

        if (user.status !== "ACTIVE") {
          return reply.status(401).send({
            success: false,
            message: "Invalid email or password",
          });
        }

        if (
          !user.organization ||
          user.organization.type !== "LENDER" ||
          user.organization.status !== "ACTIVE"
        ) {
          return reply.status(401).send({
            success: false,
            message: "Invalid email or password",
          });
        }

        // ---------------------------
        // Role validation
        // ---------------------------
        const roles = user.roles.map((r) => r.role.name);

        const allowedRoles = [
          "LENDER_ADMIN",
          "LENDER_UNDERWRITER",
          "LENDER_ANALYST",
          "LENDER_VIEWER",
        ];
        const hasAccess = roles.some((r) => allowedRoles.includes(r));

        if (!hasAccess) {
          return reply.status(403).send({
            success: false,
            message: "Access denied",
          });
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);

        if (!isValid) {
          return reply.status(401).send({
            success: false,
            message: "Invalid email or password",
          });
        }

        // Hard gate: public partner signups must verify email first
        if (!user.emailVerifiedAt) {
          return reply.status(403).send({
            success: false,
            message: "Please verify your email before signing in",
            code: "EMAIL_NOT_VERIFIED",
            data: { email: user.email },
          });
        }

        await prisma.userAccount.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

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
          jwtSecret,
          {
            expiresIn: "7d",
            issuer: "lendingcart",
            audience: "lender-app",
          },
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
              emailVerified: true,
            },
          },
        });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          message: "Server error during login",
        });
      }
    },
  );
}

module.exports = lenderLoginRoutes;
