const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { ZodError } = require("zod");
const prisma = require("../../../config/prisma");
const { loginSchema } = require("../../../schemas/loanOfficer/auth/login.schema");

const jwtSecret = require("../../../utils/auth/jwtSecret");

async function loginRoute(fastify) {
  fastify.post("/login", async (request, reply) => {
    try {
      const { email, password } = loginSchema.parse(request.body);

      const user = await prisma.userAccount.findFirst({
        where: { email, isDeleted: false },
        include: {
          roles: { include: { role: true } },
          organization: true,
          userPermissions: {
            include: { permission: { select: { key: true } } },
          },
        },
      });

      if (!user) {
        return reply.code(404).send({
          success: false,
          message: "Invalid credentials",
        });
      }

      const isOfficer = user.roles.some((r) => r.role?.name === "BROKER_OFFICER");
      if (!isOfficer) {
        return reply.code(403).send({
          success: false,
          message: "Unauthorized access",
        });
      }

      if (user.status !== "ACTIVE") {
        return reply.code(403).send({
          success: false,
          message: "Account is inactive",
        });
      }

      if (
        !user.organization ||
        user.organization.type !== "BROKER" ||
        user.organization.status !== "ACTIVE"
      ) {
        return reply.code(403).send({
          success: false,
          message: "Invalid broker organization",
        });
      }

      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        return reply.code(400).send({
          success: false,
          message: "Invalid credentials",
        });
      }

      await prisma.userAccount.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      const permissions = user.userPermissions.map((p) => p.permission.key);

      const token = jwt.sign(
        {
          userId: user.id,
          id: user.id,
          roles: ["BROKER_OFFICER"],
          organizationId: user.organizationId,
          orgType: "BROKER",
          email: user.email,
          userType: "LOAN_OFFICER",
        },
        jwtSecret,
        { expiresIn: "7d" },
      );

      return reply.code(200).send({
        success: true,
        token,
        roles: ["BROKER_OFFICER"],
        permissions,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          profileImage: user.profileImage,
          organizationId: user.organizationId,
          userType: "LOAN_OFFICER",
        },
      });
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.code(400).send({
          success: false,
          message: "Validation failed",
          errors: err.errors.map((e) => ({
            field: e.path[0],
            message: e.message,
          })),
        });
      }

      console.error(err);
      return reply.code(500).send({
        success: false,
        message: err.message || "Something went wrong",
      });
    }
  });
}

module.exports = loginRoute;
