const jwt = require("jsonwebtoken");
const jwtSecret = require("../../../utils/auth/jwtSecret");
const {
  resolveCoBrokerBranding,
} = require("../../../utils/broker/resolveCoBrokerBranding");
const {
  requireLoOfficerPermission,
} = require("../../../services/broker/loanOfficerAccess");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function impersonateSubBrokerRoutes(fastify) {
  fastify.post(
    "/:subBrokerId/impersonate",
    {
      schema: {
        tags: ["Broker -> Sub Broker"],
        summary: "Impersonate a co-broker portal session",
        params: {
          type: "object",
          required: ["subBrokerId"],
          properties: {
            subBrokerId: { type: "string", format: "uuid" },
          },
        },
      },
      preHandler: async (req, reply) => {
        await requireLoOfficerPermission(
          req,
          reply,
          fastify,
          "ACCESS_CO_BROKER_PORTAL",
        );
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

        const roles = req.user.roles || [];
        const hasAccess = roles.some((role) =>
          ["BROKER_ADMIN", "BROKER_OFFICER"].includes(role),
        );

        if (!hasAccess) {
          return reply.code(403).send({
            success: false,
            message: "Access denied",
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
        const { subBrokerId } = req.params;

        const targetUser = await prisma.userAccount.findFirst({
          where: {
            id: subBrokerId,
            organizationId: brokerOrgId,
            isDeleted: false,
            status: "ACTIVE",
            roles: {
              some: {
                role: { name: "SUB_BROKER" },
              },
            },
          },
          include: {
            organization: {
              select: { id: true, name: true },
            },
          },
        });

        if (!targetUser) {
          return reply.code(404).send({
            success: false,
            message: "Active co-broker not found",
          });
        }

        const token = jwt.sign(
          {
            userId: targetUser.id,
            id: targetUser.id,
            roles: ["SUB_BROKER"],
            organizationId: targetUser.organizationId,
            impersonatedBy: brokerUserId,
          },
          jwtSecret,
          {
            expiresIn: "2h",
            issuer: "lending-platform",
            audience: "portal",
          },
        );

        const branding = await resolveCoBrokerBranding(
          prisma,
          targetUser.id,
          targetUser.organizationId,
        );

        fastify.log.info(
          {
            brokerUserId,
            brokerOrgId,
            subBrokerId: targetUser.id,
          },
          "Broker impersonated co-broker portal",
        );

        return reply.send({
          success: true,
          token,
          user: {
            id: targetUser.id,
            firstName: targetUser.firstName,
            lastName: targetUser.lastName,
            email: targetUser.email,
            organizationId: targetUser.organizationId,
            organizationName: targetUser.organization?.name || null,
          },
          branding,
          redirectTo: "/sub-broker/loan-pipeline",
        });
      } catch (error) {
        fastify.log.error(
          { error: error.message, route: "impersonate-sub-broker" },
          "Co-broker impersonation failed",
        );

        return reply.code(500).send({
          success: false,
          message: "Failed to impersonate co-broker",
        });
      }
    },
  );
};
