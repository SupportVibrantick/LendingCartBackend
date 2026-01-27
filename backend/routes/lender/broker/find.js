/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function findLenderBrokersRoutes(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Lender -> Brokers"],
        summary: "Find brokers",
        description: "Search brokers to invite (excludes already assigned brokers)",
        querystring: {
          type: "object",
          properties: {
            q: { type: "string", description: "Search by broker name" },
            page: { type: "number", minimum: 1, default: 1 },
            limit: { type: "number", minimum: 1, maximum: 50, default: 10 },
          },
        },
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
        const { q = "", page = 1, limit = 10 } = req.query;

        const skip = (page - 1) * limit;

        // ---------------------------
        // Fetch already connected brokers
        // ---------------------------
        const connected = await prisma.brokerLenderAccess.findMany({
          where: {
            lenderOrgId,
            isActive: true,
          },
          select: {
            brokerOrgId: true,
          },
        });

        const connectedBrokerIds = connected.map((c) => c.brokerOrgId);

        // ---------------------------
        // Search brokers (exclude connected)
        // ---------------------------
        const where = {
          type: "BROKER",
          status: "ACTIVE",
          isDeleted: false,
          id: connectedBrokerIds.length
            ? { notIn: connectedBrokerIds }
            : undefined,
          ...(q
            ? {
                name: {
                  contains: q,
                  mode: "insensitive",
                },
              }
            : {}),
        };

        const [brokers, total] = await Promise.all([
          prisma.organization.findMany({
            where,
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              createdAt: true,
            },
            orderBy: {
              createdAt: "desc",
            },
            skip,
            take: limit,
          }),
          prisma.organization.count({ where }),
        ]);

        // ---------------------------
        // Response
        // ---------------------------
        return reply.send({
          success: true,
          meta: {
            page,
            limit,
            total,
          },
          data: brokers.map((b) => ({
            id: b.id,
            name: b.name,
            email: b.email
              ? b.email.replace(/(.{2}).+(@.+)/, "$1***$2")
              : null,
            phone: b.phone,
            status: "NOT_CONNECTED",
          })),
        });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          message: "Server error while searching brokers",
        });
      }
    }
  );
}

module.exports = findLenderBrokersRoutes;
