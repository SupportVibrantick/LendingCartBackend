const jwt = require("jsonwebtoken");
const jwtSecret = require("../../../utils/auth/jwtSecret");
const { adminLogs } = require("../../../services/logger/contextLogger");
const {
  normalizeLoanOfficerPermissions,
} = require("../../../utils/broker/loanOfficerPermissions");
const {
  resolveCoBrokerBranding,
} = require("../../../utils/broker/resolveCoBrokerBranding");
const {
  resolveClientDisplayName,
} = require("../../../utils/applications/resolveClientDisplayName");
const {
  ensureClientPortalUserForImpersonation,
} = require("../../../services/clientPortal/ensureClientPortalUserForImpersonation");

async function assertActiveBrokerOrg(prisma, orgId) {
  const organization = await prisma.organization.findFirst({
    where: {
      id: orgId,
      type: "BROKER",
      isDeleted: false,
    },
    select: { id: true, name: true, type: true, status: true },
  });

  if (!organization) {
    const err = new Error("Broker organization not found");
    err.statusCode = 404;
    throw err;
  }

  if (organization.status !== "ACTIVE") {
    const err = new Error("Broker organization is not active");
    err.statusCode = 403;
    throw err;
  }

  return organization;
}

/**
 * Platform admin impersonation of LO / co-broker / client portals
 * for a specific broker organization (opens in broker-dashboard).
 *
 * @param {import("fastify").FastifyInstance} fastify
 */
async function portalImpersonateRoutes(fastify) {
  fastify.post(
    "/loan-officers/:orgId/:userId/impersonate",
    {
      schema: {
        tags: ["Admin -> Brokers"],
        summary: "Impersonate a loan officer portal for a broker organization",
        params: {
          type: "object",
          required: ["orgId", "userId"],
          properties: {
            orgId: { type: "string", format: "uuid" },
            userId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const adminUserId = req.user.userId || req.user.id;
      const { orgId, userId } = req.params;

      try {
        if (req.user.impersonatedBy) {
          return reply.code(400).send({
            success: false,
            message: "Exit the current impersonation session first",
          });
        }

        const organization = await assertActiveBrokerOrg(prisma, orgId);

        const targetUser = await prisma.userAccount.findFirst({
          where: {
            id: userId,
            organizationId: orgId,
            isDeleted: false,
            status: "ACTIVE",
            roles: {
              some: {
                role: { name: "BROKER_OFFICER" },
              },
            },
          },
          include: {
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
            userType: "LOAN_OFFICER",
            impersonatedBy: adminUserId,
          },
          jwtSecret,
          {
            expiresIn: "2h",
            issuer: "lending-platform",
            audience: "portal",
          },
        );

        adminLogs.info("Admin impersonated loan officer portal", {
          superAdminId: adminUserId,
          targetOrgId: orgId,
          loanOfficerId: targetUser.id,
          ip: req.ip,
        });

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
            organizationName: organization.name || null,
            userType: "LOAN_OFFICER",
          },
          redirectTo: "/loan-officer/dashboard",
        });
      } catch (error) {
        if (error.statusCode) {
          return reply.code(error.statusCode).send({
            success: false,
            message: error.message,
          });
        }

        adminLogs.error("Admin loan officer impersonation failed", error);
        return reply.code(500).send({
          success: false,
          message: "Failed to impersonate loan officer",
        });
      }
    },
  );

  fastify.post(
    "/sub-brokers/:orgId/:userId/impersonate",
    {
      schema: {
        tags: ["Admin -> Brokers"],
        summary: "Impersonate a co-broker portal for a broker organization",
        params: {
          type: "object",
          required: ["orgId", "userId"],
          properties: {
            orgId: { type: "string", format: "uuid" },
            userId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const adminUserId = req.user.userId || req.user.id;
      const { orgId, userId } = req.params;

      try {
        if (req.user.impersonatedBy) {
          return reply.code(400).send({
            success: false,
            message: "Exit the current impersonation session first",
          });
        }

        const organization = await assertActiveBrokerOrg(prisma, orgId);

        const targetUser = await prisma.userAccount.findFirst({
          where: {
            id: userId,
            organizationId: orgId,
            isDeleted: false,
            status: "ACTIVE",
            roles: {
              some: {
                role: { name: "SUB_BROKER" },
              },
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
            impersonatedBy: adminUserId,
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

        adminLogs.info("Admin impersonated co-broker portal", {
          superAdminId: adminUserId,
          targetOrgId: orgId,
          subBrokerId: targetUser.id,
          ip: req.ip,
        });

        return reply.send({
          success: true,
          token,
          user: {
            id: targetUser.id,
            firstName: targetUser.firstName,
            lastName: targetUser.lastName,
            email: targetUser.email,
            organizationId: targetUser.organizationId,
            organizationName: organization.name || null,
          },
          branding,
          redirectTo: "/sub-broker/loan-pipeline",
        });
      } catch (error) {
        if (error.statusCode) {
          return reply.code(error.statusCode).send({
            success: false,
            message: error.message,
          });
        }

        adminLogs.error("Admin co-broker impersonation failed", error);
        return reply.code(500).send({
          success: false,
          message: "Failed to impersonate co-broker",
        });
      }
    },
  );

  fastify.post(
    "/:orgId/clients/:clientId/impersonate",
    {
      schema: {
        tags: ["Admin -> Brokers"],
        summary: "Impersonate a client portal for a broker organization",
        params: {
          type: "object",
          required: ["orgId", "clientId"],
          properties: {
            orgId: { type: "string", format: "uuid" },
            clientId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const adminUserId = req.user.userId || req.user.id;
      const { orgId, clientId } = req.params;

      try {
        if (req.user.impersonatedBy) {
          return reply.code(400).send({
            success: false,
            message: "Exit the current impersonation session first",
          });
        }

        await assertActiveBrokerOrg(prisma, orgId);

        const client = await prisma.client.findFirst({
          where: {
            id: clientId,
            primaryBrokerOrgId: orgId,
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
            message: "Active client not found for this broker",
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
            impersonatedBy: adminUserId,
          },
          jwtSecret,
          {
            expiresIn: "2h",
            issuer: "lending-platform",
            audience: "portal",
          },
        );

        adminLogs.info("Admin impersonated client portal", {
          superAdminId: adminUserId,
          targetOrgId: orgId,
          clientId: client.id,
          portalUserId: portalUser.id,
          ip: req.ip,
        });

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
        if (error.statusCode) {
          return reply.code(error.statusCode).send({
            success: false,
            message: error.message,
          });
        }

        adminLogs.error("Admin client impersonation failed", error);
        return reply.code(500).send({
          success: false,
          message: "Failed to impersonate client",
        });
      }
    },
  );
}

module.exports = portalImpersonateRoutes;
