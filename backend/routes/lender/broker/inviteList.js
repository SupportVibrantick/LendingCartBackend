/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function listInvitedBrokersRoutes(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Lender -> Brokers"],
        summary: "List invited brokers",
        description: "Shows brokers invited by lender with invite status",
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

        // ---------------------------
        // Fetch invites
        // ---------------------------
        const invites = await prisma.brokerLenderInvite.findMany({
          where: {
            lenderOrgId,
          },
          select: {
            id: true,
            status: true,
            initiatedBy: true,
            createdAt: true,
            broker: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                status: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        });

        const stats = {
          total: invites.length,
          pending: 0,
          accepted: 0,
          rejected: 0,
        };

        const data = invites.map((i) => {
          if (i.status === "PENDING") stats.pending += 1;
          else if (i.status === "ACCEPTED") stats.accepted += 1;
          else if (i.status === "REJECTED") stats.rejected += 1;

          return {
            inviteId: i.id,
            brokerId: i.broker.id,
            name: i.broker.name,
            email: i.broker.email,
            phone: i.broker.phone,
            brokerStatus: i.broker.status,
            inviteStatus: i.status,
            initiatedBy: i.initiatedBy,
            direction: i.initiatedBy === "BROKER" ? "incoming" : "outgoing",
            invitedAt: i.createdAt,
          };
        });

        return reply.send({
          success: true,
          stats,
          data,
        });
      } catch (error) {
        req.log.error(error);

        return reply.status(500).send({
          success: false,
          message: "Server error while fetching invited brokers",
        });
      }
    }
  );
}

module.exports = listInvitedBrokersRoutes;
