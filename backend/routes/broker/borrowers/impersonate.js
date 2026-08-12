const jwt = require("jsonwebtoken");
const jwtSecret = require("../../../utils/auth/jwtSecret");
const { resolveClientDisplayName } = require("../../../utils/applications/resolveClientDisplayName");
const {
  requireLoOfficerPermission,
} = require("../../../services/broker/loanOfficerAccess");
const {
  ensureClientPortalUserForImpersonation,
} = require("../../../services/clientPortal/ensureClientPortalUserForImpersonation");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function impersonateBorrowerRoute(fastify) {
  fastify.post(
    "/:clientId/impersonate",
    {
      schema: {
        tags: ["Broker -> Borrowers"],
        summary: "Impersonate a borrower client portal session",
        params: {
          type: "object",
          required: ["clientId"],
          properties: {
            clientId: { type: "string", format: "uuid" },
          },
        },
      },
      preHandler: async (req, reply) => {
        await requireLoOfficerPermission(
          req,
          reply,
          fastify,
          "ACCESS_BORROWER_PORTAL",
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
        const isOfficer = roles.includes("BROKER_OFFICER");
        const { clientId } = req.params;

        const client = await prisma.client.findFirst({
          where: {
            id: clientId,
            primaryBrokerOrgId: brokerOrgId,
            isDeleted: false,
            isActive: true,
          },
          include: {
            contacts: {
              where: { isPrimary: true },
              take: 1,
            },
            portalUsers: {
              where: {
                isDeleted: false,
                isActive: true,
              },
              orderBy: [{ lastLoginAt: "desc" }, { createdAt: "desc" }],
              take: 1,
            },
          },
        });

        if (!client) {
          return reply.code(404).send({
            success: false,
            message: "Borrower not found",
          });
        }

        const hasApplication = await prisma.loanApplication.findFirst({
          where: {
            brokerOrgId,
            clientId,
            ...(isOfficer ? { brokerUserId } : {}),
          },
          select: { id: true },
        });

        if (!hasApplication) {
          return reply.code(404).send({
            success: false,
            message: "Borrower not found for your organization",
          });
        }

        let portalUser = client.portalUsers[0];
        if (!portalUser) {
          try {
            portalUser = await ensureClientPortalUserForImpersonation(prisma, {
              clientId: client.id,
              contacts: client.contacts,
            });
          } catch (provisionError) {
            return reply.code(provisionError.statusCode || 400).send({
              success: false,
              message:
                provisionError.clientMessage ||
                provisionError.message ||
                "Unable to open client portal for this borrower",
            });
          }
        }

        const clientName = await resolveClientDisplayName(prisma, {
          clientId: client.id,
          client,
          contacts: client.contacts,
        });

        const token = jwt.sign(
          {
            id: portalUser.id,
            clientId: client.id,
            email: portalUser.email,
            clientEmail: portalUser.email,
            clientName,
            role: "CLIENT",
            orgType: "CLIENT",
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
            clientId: client.id,
            portalUserId: portalUser.id,
          },
          "Broker impersonated client portal",
        );

        return reply.send({
          success: true,
          token,
          user: {
            id: portalUser.id,
            email: portalUser.email,
            clientId: client.id,
            clientName,
          },
          redirectTo: "/client-portal",
        });
      } catch (error) {
        fastify.log.error(
          { error: error.message, route: "impersonate-borrower" },
          "Borrower impersonation failed",
        );

        return reply.code(500).send({
          success: false,
          message: "Failed to impersonate borrower",
        });
      }
    },
  );
};
