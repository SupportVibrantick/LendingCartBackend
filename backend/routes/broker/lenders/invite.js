/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function inviteLenderRoutes(fastify) {
  fastify.post(
    "/invite",
    {
      schema: {
        tags: ["Broker -> Lenders"],
        summary: "Invite lender",
        description: "Broker invites a lender to connect",
        body: {
          type: "object",
          required: ["lenderOrgId"],
          additionalProperties: false,
          properties: {
            lenderOrgId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        // ---------------------------
        // Auth safety (Broker only)
        // ---------------------------
        if (
          !req.user ||
          req.user.orgType !== "BROKER" ||
          !req.user.organizationId
        ) {
          return reply.status(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const brokerOrgId = req.user.organizationId;
        const { lenderOrgId } = req.body;

        // ---------------------------
        // Prevent self-invite
        // ---------------------------
        if (brokerOrgId === lenderOrgId) {
          return reply.status(400).send({
            success: false,
            message: "Invalid lender",
          });
        }

        // ---------------------------
        // Validate lender organization
        // IMPORTANT: prevents FK error
        // ---------------------------
        const lenderOrg = await prisma.organization.findFirst({
          where: {
            id: lenderOrgId,
            type: "LENDER",
            isDeleted: false,
          },
        });

        if (!lenderOrg) {
          return reply.status(404).send({
            success: false,
            message: "Lender organization not found",
          });
        }

        // ---------------------------
        // Already connected?
        // ---------------------------
        const existingAccess =
          await prisma.brokerLenderAccess.findFirst({
            where: {
              brokerOrgId,
              lenderOrgId,
              isActive: true,
            },
          });

        if (existingAccess) {
          return reply.status(409).send({
            success: false,
            message: "Lender already connected",
          });
        }

        // ---------------------------
        // Create or re-send invite
        // ---------------------------
        const invite = await prisma.brokerLenderInvite.upsert({
          where: {
            lenderOrgId_brokerOrgId: {
              lenderOrgId,
              brokerOrgId,
            },
          },
          update: {
            status: "PENDING",
            initiatedBy: "BROKER",
          },
          create: {
            lenderOrgId,
            brokerOrgId,
            status: "PENDING",
            initiatedBy: "BROKER",
          },
        });

        return reply.send({
          success: true,
          message: "Invite sent successfully",
          data: {
            id: invite.id,
            lenderOrgId: invite.lenderOrgId,
            brokerOrgId: invite.brokerOrgId,
            status: invite.status,
            createdAt: invite.createdAt,
          },
        });
      } catch (error) {
        req.log.error(error);
        return reply.status(500).send({
          success: false,
          message: error.message || "Server error while sending invite",
        });
      }
    }
  );
}

module.exports = inviteLenderRoutes;
