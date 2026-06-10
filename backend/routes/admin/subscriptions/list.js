/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function listSubscriptionPackagesRoutes(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Admin -> Subscriptions"],
        summary: "List Subscription Packages",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      try {
        const { page = 1, limit = 20, search, isActive } = req.query;

        const skip = (Number(page) - 1) * Number(limit);

        const where = {
          ...(typeof isActive !== "undefined"
            ? { isActive: isActive === "true" }
            : {}),
          ...(search
            ? {
                OR: [
                  { name: { contains: search, mode: "insensitive" } },
                  { code: { contains: search, mode: "insensitive" } },
                ],
              }
            : {}),
        };

        const [total, data] = await Promise.all([
          prisma.subscriptionPackage.count({ where }),
          prisma.subscriptionPackage.findMany({
            where,
            skip,
            take: Number(limit),
            orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
          }),
        ]);

        return reply.send({
          success: true,
          data,
          meta: {
            total,
            page: Number(page),
            limit: Number(limit),
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          success: false,
          message: error.message || "Failed to fetch subscription packages",
        });
      }
    }
  );
}

module.exports = listSubscriptionPackagesRoutes;
