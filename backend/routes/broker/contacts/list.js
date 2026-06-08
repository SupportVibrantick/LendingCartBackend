module.exports = async function listContactsRoutes(fastify) {
  fastify.get(
    "/list",
    {
      schema: {
        tags: ["Broker -> Contacts"],
        summary: "List contacts",
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
            search: { type: "string" }
          }
        }
      }
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        /* ================= AUTHORIZATION ================= */

        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only"
          });
        }

        const brokerOrgId = req.user.organizationId;
        const userId = req.user.id || req.user.userId;

        /* ================= QUERY ================= */

        const page = Number(req.query.page || 1);
        const limit = Number(req.query.limit || 20);
        const search = req.query.search || "";

        const skip = (page - 1) * limit;

        /* ================= FILTER ================= */

        const where = {
          brokerOrgId,
          isDeleted: false,
          ...(req.user.roles?.includes("BROKER_OFFICER") && {
            createdById: userId,
          }),
          OR: search
            ? [
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { companyName: { contains: search, mode: "insensitive" } }
              ]
            : undefined
        };

        /* ================= FETCH ================= */

        const [contacts, total] = await prisma.$transaction([
          prisma.contact.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: limit
          }),
          prisma.contact.count({ where })
        ]);

        /* ================= RESPONSE ================= */

        return reply.send({
          success: true,
          data: contacts,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
          }
        });

      } catch (error) {
        fastify.log.error({
          error: error.message,
          stack: error.stack
        });

        return reply.code(500).send({
          success: false,
          message: "Internal server error while fetching contacts"
        });
      }
    }
  );
};