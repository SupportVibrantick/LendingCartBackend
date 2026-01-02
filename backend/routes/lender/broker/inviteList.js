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
          include: {
            broker: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                status: true,
                createdAt: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        });

        // ---------------------------
        // Stats
        // ---------------------------
        const stats = {
          total: invites.length,
          pending: invites.filter(i => i.status === "PENDING").length,
          accepted: invites.filter(i => i.status === "ACCEPTED").length,
          rejected: invites.filter(i => i.status === "REJECTED").length,
        };

        // ---------------------------
        // Response
        // ---------------------------
        return reply.send({
          success: true,
          stats,
          data: invites.map((i) => ({
            inviteId: i.id,
            brokerId: i.broker.id,
            name: i.broker.name,
            email: i.broker.email,
            phone: i.broker.phone,
            brokerStatus: i.broker.status,
            inviteStatus: i.status,
            invitedAt: i.createdAt,
          })),
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
