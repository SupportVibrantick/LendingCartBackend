async function listInvoicesRoutes(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Admin -> Subscriptions"],
        summary: "List subscription invoices",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      try {
        const { page = 1, limit = 20, orgId, status, search } = req.query;
        const pageNum = Math.max(Number(page) || 1, 1);
        const limitNum = Math.min(Math.max(Number(limit) || 20, 1), 100);
        const skip = (pageNum - 1) * limitNum;
        const term = typeof search === "string" ? search.trim() : "";

        const where = {};
        if (orgId) where.organizationId = orgId;
        if (status) where.status = status;
        if (term) {
          where.OR = [
            { invoiceNumber: { contains: term, mode: "insensitive" } },
            { organization: { name: { contains: term, mode: "insensitive" } } },
            { organization: { email: { contains: term, mode: "insensitive" } } },
            {
              organizationSubscription: {
                package: {
                  OR: [
                    { name: { contains: term, mode: "insensitive" } },
                    { code: { contains: term, mode: "insensitive" } },
                  ],
                },
              },
            },
          ];
        }

        const [total, data] = await Promise.all([
          prisma.subscriptionInvoice.count({ where }),
          prisma.subscriptionInvoice.findMany({
            where,
            skip,
            take: limitNum,
            orderBy: { createdAt: "desc" },
            include: {
              organization: {
                select: { id: true, name: true, email: true },
              },
              organizationSubscription: {
                include: {
                  package: {
                    select: { id: true, name: true, code: true },
                  },
                },
              },
            },
          }),
        ]);

        return reply.send({
          success: true,
          data,
          meta: { total, page: pageNum, limit: limitNum },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          success: false,
          message: "Failed to fetch invoices",
        });
      }
    },
  );
}

module.exports = listInvoicesRoutes;
