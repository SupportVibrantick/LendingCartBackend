const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
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
      },
    },
    async (req, reply) => {
      const { email, password } = req.body;

      if (!email || !password) {
        return reply.status(400).send({
          success: false,
          message: "Email and password are required",
        });
      }

      //  Find user
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
          message: "Invalid credentials",
        });
      }

      //  Verify role
      const hasLenderRole = user.roles.some((r) =>
        ["LENDER_ADMIN", "LENDER_UNDERWRITER"].includes(r.role.name)
      );

      if (!hasLenderRole) {
        return reply.status(403).send({
          success: false,
          message: "Access denied",
        });
      }

      // Verify password
      const validPassword = await bcrypt.compare(password, user.passwordHash);

      if (!validPassword) {
        return reply.status(401).send({
          success: false,
          message: "Invalid credentials",
        });
      }

      // Issue token
      const token = jwt.sign(
        {
          sub: user.id,
          orgId: user.organizationId,
          role: "LENDER",
        },
        process.env.JWT_SECRET,
        { expiresIn: "15m" }
      );

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
          },
        },
      });
    }
  );
}

module.exports = lenderLoginRoutes;
