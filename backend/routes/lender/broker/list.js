/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function listLenderBrokersRoutes(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Lender -> Brokers"],
        summary: "List brokers assigned to lender",
        description:
          "Returns brokers connected to the lender with connection status",
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
        // Fetch ALL broker connections
        // ---------------------------
        const brokers = await prisma.brokerLenderAccess.findMany({
          where: {
            lenderOrgId, // ❗ no isActive filter
          },
          include: {
            broker: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                status: true, // global broker status
                createdAt: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        });

        // ---------------------------
        // Response mapping
        // ---------------------------
        return reply.send({
          success: true,
          data: brokers.map((b) => ({
            id: b.broker.id,
            name: b.broker.name,
            email: b.broker.email,
            phone: b.broker.phone,

            // Global broker state
            brokerStatus: b.broker.status, // ACTIVE / INACTIVE

            // Lender-level relationship state
            connectionStatus: b.isActive ? "CONNECTED" : "DISABLED",

            source: b.source,
            assignedAt: b.createdAt,
          })),
        });
      } catch (error) {
        req.log.error(error);
        return reply.status(500).send({
          success: false,
          message: "Server error while fetching brokers",
        });
      }
    }
  );
}

module.exports = listLenderBrokersRoutes;
