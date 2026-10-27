const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { ZodError } = require("zod");
const prisma = require("../../../config/prisma");
const { loginSchema } = require("../../../schemas/loanOfficer/auth/login.schema");

const jwtSecret = require("../../../utils/auth/jwtSecret");
const {
  normalizeLoanOfficerPermissions,
  DEFAULT_PUBLIC_JOIN_LO_PERMISSIONS,
} = require("../../../utils/broker/loanOfficerPermissions");
const {
  syncUserPermissions,
} = require("../../../utils/broker/brokerUserProfileHelpers");

async function loginRoute(fastify) {
  fastify.post(
    "/login",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "15 minutes",
          errorResponseBuilder: () => ({
            statusCode: 429,
            error: "Too Many Requests",
            success: false,
            message: "Too many login attempts. Please try again after 15 minutes.",
          }),
        },
      },
    },
    async (request, reply) => {
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
        return reply.code(401).send({
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
        return reply.code(401).send({
          success: false,
          message: "Invalid credentials",
        });
      }

      await prisma.userAccount.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      let permissionKeys = user.userPermissions.map((p) => p.permission.key);

      // Heal LOs who joined via public invite before defaults were assigned.
      if (permissionKeys.length === 0) {
        const profile = await prisma.brokerUserProfile.findUnique({
          where: { userId: user.id },
          select: { profileData: true },
        });
        const source =
          profile?.profileData &&
          typeof profile.profileData === "object" &&
          !Array.isArray(profile.profileData)
            ? profile.profileData.source
            : null;

        if (source === "PUBLIC_TEAM_INVITE") {
          await syncUserPermissions(
            prisma,
            user.id,
            DEFAULT_PUBLIC_JOIN_LO_PERMISSIONS,
          );
          permissionKeys = [...DEFAULT_PUBLIC_JOIN_LO_PERMISSIONS];
        }
      }

      const permissions = normalizeLoanOfficerPermissions(permissionKeys);

      const token = jwt.sign(
        {
          userId: user.id,
          id: user.id,
          roles: ["BROKER_OFFICER"],
          permissions,
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
      throw err;
    }
  });
}

module.exports = loginRoute;
