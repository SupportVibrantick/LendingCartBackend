/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function listDocumentTypesRoutes(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Admin -> Document Types"],
        summary: "List Document Types",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      try {
        const {
          page = 1,
          limit = 20,
          search,
          isActive,
        } = req.query;

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
          prisma.documentType.count({ where }),
          prisma.documentType.findMany({
            where,
            skip,
            take: Number(limit),
            orderBy: { createdAt: "desc" },
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
        return reply.status(500).send({
          success: false,
          message: "Failed to fetch document types",
        });
      }
    }
  );
}

module.exports = listDocumentTypesRoutes;
