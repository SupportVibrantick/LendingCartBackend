/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function inviteBrokerRoutes(fastify) {
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Lender -> Brokers"],
        summary: "Invite broker",
        description: "Lender invites a broker to connect",
        body: {
          type: "object",
          required: ["brokerOrgId"],
          additionalProperties: false,
          properties: {
            brokerOrgId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        // ---------------------------
        // Auth safety
        // ---------------------------
        if (
          !req.user ||
          req.user.orgType !== "LENDER" ||
          !req.user.organizationId
        ) {
          return reply.status(403).send({
            success: false,
            message: "Lender access only",
          });
        }

        const lenderOrgId = req.user.organizationId;
        const { brokerOrgId } = req.body;

        // ---------------------------
        // Prevent self-invite
        // ---------------------------
        if (lenderOrgId === brokerOrgId) {
          return reply.status(400).send({
            success: false,
            message: "Invalid broker",
          });
        }

        // ---------------------------
        // Already connected?
        // ---------------------------
        const existingAccess = await prisma.brokerLenderAccess.findFirst({
          where: {
            lenderOrgId,
            brokerOrgId,
            isActive: true,
          },
        });

        if (existingAccess) {
          return reply.status(409).send({
            success: false,
            message: "Broker already connected",
          });
        }

        // ---------------------------
        // Create or reset invite
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
            initiatedBy: "LENDER",
          },
          create: {
            lenderOrgId,
            brokerOrgId,
            status: "PENDING",
            initiatedBy: "LENDER",
          },
        });

        return reply.send({
          success: true,
          message: "Invite sent successfully",
          data: {
            id: invite.id,
            brokerOrgId: invite.brokerOrgId,
            status: invite.status,
            createdAt: invite.createdAt,
          },
        });
      } catch (error) {
        req.log.error(error);

        return reply.status(500).send({
          success: false,
          message: "Server error while sending invite",
        });
      }
    }
  );
}

module.exports = inviteBrokerRoutes;
