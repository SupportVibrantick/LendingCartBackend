const jwt = require("jsonwebtoken");
const jwtSecret = require("../../../utils/auth/jwtSecret");
const {
  normalizeLoanOfficerPermissions,
} = require("../../../utils/broker/loanOfficerPermissions");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function impersonateLoanOfficerRoute(fastify) {
  fastify.post(
    "/:id/impersonate",
    {
      schema: {
        tags: ["Broker -> Users"],
        summary: "Impersonate a loan officer portal session",
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        if (!req.user?.organizationId || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        if (!req.user.roles?.includes("BROKER_ADMIN")) {
          return reply.code(403).send({
            success: false,
            message: "Only Broker Admin can impersonate loan officers",
          });
        }

        if (req.user.impersonatedBy) {
          return reply.code(400).send({
            success: false,
            message: "Exit the current impersonation session first",
          });
        }

        const brokerUserId = req.user.userId || req.user.id;
        const brokerOrgId = req.user.organizationId;
        const { id: loanOfficerId } = req.params;

        const targetUser = await prisma.userAccount.findFirst({
          where: {
            id: loanOfficerId,
            organizationId: brokerOrgId,
            isDeleted: false,
            status: "ACTIVE",
            roles: {
              some: {
                role: { name: "BROKER_OFFICER" },
              },
            },
          },
          include: {
            organization: {
              select: { id: true, name: true, type: true, status: true },
            },
            userPermissions: {
              include: { permission: { select: { key: true } } },
            },
          },
        });

        if (!targetUser) {
          return reply.code(404).send({
            success: false,
            message: "Active loan officer not found",
          });
        }

        if (
          !targetUser.organization ||
          targetUser.organization.type !== "BROKER" ||
          targetUser.organization.status !== "ACTIVE"
        ) {
          return reply.code(403).send({
            success: false,
            message: "Invalid broker organization",
          });
        }

        const permissions = normalizeLoanOfficerPermissions(
          targetUser.userPermissions.map((p) => p.permission.key),
        );

        const token = jwt.sign(
          {
            userId: targetUser.id,
            id: targetUser.id,
            roles: ["BROKER_OFFICER"],
            permissions,
            organizationId: targetUser.organizationId,
            orgType: "BROKER",
            email: targetUser.email,
            permissions,
            userType: "LOAN_OFFICER",
            impersonatedBy: brokerUserId,
          },
          jwtSecret,
          {
            expiresIn: "2h",
            issuer: "lending-platform",
            audience: "portal",
          },
        );

        fastify.log.info(
          {
            brokerUserId,
            brokerOrgId,
            loanOfficerId: targetUser.id,
          },
          "Broker impersonated loan officer portal",
        );

        return reply.send({
          success: true,
          token,
          roles: ["BROKER_OFFICER"],
          permissions,
          user: {
            id: targetUser.id,
            firstName: targetUser.firstName,
            lastName: targetUser.lastName,
            email: targetUser.email,
            profileImage: targetUser.profileImage,
            organizationId: targetUser.organizationId,
            organizationName: targetUser.organization?.name || null,
            userType: "LOAN_OFFICER",
          },
          redirectTo: "/loan-officer/dashboard",
        });
      } catch (error) {
        fastify.log.error(
          { error: error.message, route: "impersonate-loan-officer" },
          "Loan officer impersonation failed",
        );

        return reply.code(500).send({
          success: false,
          message: "Failed to impersonate loan officer",
        });
      }
    },
  );
};
