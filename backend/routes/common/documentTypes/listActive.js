module.exports = async function listActiveDocumentTypes(fastify) {
  fastify.get(
    "/active",
    {
      schema: {
        tags: ["Common -> Document Types"],
        summary: "Get active document types",
        querystring: {
          type: "object",
          properties: {
            page: {
              type: "integer",
              minimum: 1,
              default: 1,
            },
            limit: {
              type: "integer",
              minimum: 1,
              maximum: 100,
              default: 50,
            },
            search: {
              type: "string",
            },
            all: {
              anyOf: [{ type: "boolean" }, { type: "string" }],
              default: false,
            },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      await fastify.authenticate(req, reply);

      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 50);
      const search = req.query.search?.trim(); 
      const all = req.query.all === true || req.query.all === "true";

      const where = {
        isActive: true,
        OR: [
          { isCustom: false },
          {
            isCustom: true,
            createdByOrgId: req.user?.organizationId || undefined,
          },
        ],
        ...(search && {
          AND: [
            {
              OR: [
                {
                  name: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
                {
                  code: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
                {
                  description: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              ],
            },
          ],
        }),
      };

      const [docs, total] = await Promise.all([
        prisma.documentType.findMany({
          where,
          select: {
            id: true,
            name: true,
            code: true,
            description: true,
            isCustom: true,
          },
          orderBy: [
            { isCustom: "desc" },
            { createdAt: "desc" },
            { name: "asc" },
          ],
          ...(all
            ? {}
            : {
                skip: (page - 1) * limit,
                take: limit,
              }),
        }),
        prisma.documentType.count({ where }),
      ]);

      const response = {
        success: true,
        data: docs,
      };

      if (!all) {
        response.pagination = {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page * limit < total,
          hasPreviousPage: page > 1,
        };
      }

      return response;
    }
  );
};