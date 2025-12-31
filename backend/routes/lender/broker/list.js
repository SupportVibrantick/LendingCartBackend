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
        description: "Returns brokers mapped to the authenticated lender",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      try {
        // ---------------------------
        // Auth safety (middleware-aligned)
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
        // Fetch mapped brokers
        // ---------------------------
        const brokers = await prisma.brokerLenderAccess.findMany({
          where: {
            lenderOrgId,
            isActive: true,
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
        // Response mapping
        // ---------------------------
        return reply.send({
          success: true,
          data: brokers.map((b) => ({
            id: b.broker.id,
            name: b.broker.name,
            email: b.broker.email,
            phone: b.broker.phone,
            status: b.broker.status,
            source: b.source,
            assignedAt: b.createdAt,
          })),
        });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          message: "Server error while fetching brokers",
        });
      }
    }
  );
}

module.exports = listLenderBrokersRoutes;
