const {
  getOrCreatePublicApplicationLink,
  buildPublicApplicationSharePath,
  normalizeSourcePortalOption,
  shouldShowCoBrokerBorrowerInformationTab,
} = require("../../../services/applications/publicApplicationLink");

/**
 * Portal-aware client application link endpoint.
 * sourcePortal MUST be supplied by the registering route (server-side), never by the client.
 *
 * @param {{ sourcePortal?: "BROKER" | "LOAN_OFFICER" | "CO_BROKER" }} options
 */
module.exports = function createGetClientApplicationLink(options = {}) {
  const forcedSourcePortal = normalizeSourcePortalOption(options.sourcePortal);

  /**
   * @param {import("fastify").FastifyInstance} fastify
   */
  return async function getClientApplicationLink(fastify) {
    fastify.get(
      "/client-application-link",
      {
        schema: {
          tags: ["Broker -> Loan Pipeline"],
          summary:
            "Get shareable client loan application link for this authenticated portal user",
        },
      },
      async (req, reply) => {
        const prisma = fastify.prisma;

        try {
          const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
          const isBrokerPortal =
            req.user?.orgType === "BROKER" && Boolean(req.user?.organizationId);
          const isSubBrokerPortal =
            roles.includes("SUB_BROKER") && Boolean(req.user?.organizationId);
          const isLoanOfficerPortal =
            roles.includes("BROKER_OFFICER") &&
            Boolean(req.user?.organizationId);

          if (!isBrokerPortal && !isSubBrokerPortal && !isLoanOfficerPortal) {
            return reply.code(403).send({
              success: false,
              message: "Broker access only",
            });
          }

          if (
            forcedSourcePortal === "CO_BROKER" &&
            !roles.includes("SUB_BROKER")
          ) {
            return reply.code(403).send({
              success: false,
              message: "Co-broker access only",
            });
          }

          if (
            forcedSourcePortal === "LOAN_OFFICER" &&
            !roles.includes("BROKER_OFFICER")
          ) {
            return reply.code(403).send({
              success: false,
              message: "Loan officer access only",
            });
          }

          const brokerOrgId = req.user.organizationId;
          const createdByUserId = req.user.id || req.user.userId;

          if (!createdByUserId) {
            return reply.code(401).send({
              success: false,
              message: "Invalid token (missing user id)",
            });
          }

          const organization = await prisma.organization.findUnique({
            where: { id: brokerOrgId },
            select: {
              id: true,
              name: true,
              email: true,
              status: true,
              type: true,
            },
          });

          if (
            !organization ||
            organization.type !== "BROKER" ||
            organization.status !== "ACTIVE"
          ) {
            return reply.code(404).send({
              success: false,
              message: "Broker organization not found",
            });
          }

          const activeProductCount = await prisma.loanProduct.count({
            where: { isActive: true },
          });

          const link = await getOrCreatePublicApplicationLink(prisma, {
            brokerOrganizationId: brokerOrgId,
            createdByUserId,
            sourcePortal: forcedSourcePortal,
          });

          const embedBase = (
            process.env.EMBED_APP_URL ||
            process.env.VITE_EMBED_APP_URL ||
            ""
          ).replace(/\/$/, "");

          const sharePath = buildPublicApplicationSharePath(link.token);
          const shareUrl = embedBase ? `${embedBase}${sharePath}` : sharePath;

          return reply.send({
            success: true,
            data: {
              brokerOrgId,
              brokerOrganizationId: brokerOrgId,
              brokerName: organization.name,
              brokerEmail: organization.email,
              ref: link.token,
              sourcePortal: link.sourcePortal,
              createdByUserId: link.createdByUserId,
              loanOfficerId: link.loanOfficerId,
              coBrokerId: link.coBrokerId,
              showCoBrokerBorrowerInformationTab:
                shouldShowCoBrokerBorrowerInformationTab(link.sourcePortal),
              hasActiveApplication: true,
              catalogProductCount: activeProductCount,
              applicationId: null,
              applicationName: null,
              sharePath,
              shareUrl,
              embedBaseUrl: embedBase || null,
            },
          });
        } catch (error) {
          fastify.log.error(error);
          return reply.code(500).send({
            success: false,
            message: "Failed to build client application link",
          });
        }
      },
    );
  };
};
