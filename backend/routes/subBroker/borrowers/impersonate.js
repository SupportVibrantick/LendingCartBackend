const jwt = require("jsonwebtoken");
const jwtSecret = require("../../../utils/auth/jwtSecret");
const {
  resolveClientDisplayName,
} = require("../../../utils/applications/resolveClientDisplayName");
const {
  ensureClientPortalUserForImpersonation,
} = require("../../../services/clientPortal/ensureClientPortalUserForImpersonation");

module.exports = async function subBrokerImpersonateBorrowerRoute(fastify) {
  fastify.post(
    "/:clientId/impersonate",
    {
      preHandler: [fastify.authenticate, fastify.requireRole(["SUB_BROKER"])],
      schema: {
        tags: ["Sub Broker -> Borrowers"],
        summary: "Open client portal for an assigned borrower",
        params: {
          type: "object",
          required: ["clientId"],
          properties: {
            clientId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        const subBrokerId = req.user.id || req.user.userId;
        const brokerOrgId = req.user.organizationId;

        if (!subBrokerId || !brokerOrgId) {
          return reply.code(403).send({
            success: false,
            message: "Unauthorized access",
          });
        }

        if (req.user.impersonatedBy) {
          return reply.code(400).send({
            success: false,
            message: "Exit the current impersonation session first",
          });
        }

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

        const hasAssignment = await prisma.loanApplication.findFirst({
          where: {
            brokerOrgId,
            clientId,
            subBrokerAssignments: {
              some: { subBrokerId },
            },
          },
          select: { id: true },
        });

        if (!hasAssignment) {
          return reply.code(404).send({
            success: false,
            message: "Borrower not found in your assigned applications",
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
            impersonatedBy: subBrokerId,
          },
          jwtSecret,
          {
            expiresIn: "2h",
            issuer: "lending-platform",
            audience: "portal",
          },
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
          { error: error.message, route: "subbroker-impersonate-borrower" },
          "Co-broker borrower impersonation failed",
        );

        return reply.code(500).send({
          success: false,
          message: "Failed to open client portal",
        });
      }
    },
  );
};
