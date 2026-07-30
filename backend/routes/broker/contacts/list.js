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
            search: { type: "string" },
            sortBy: {
              type: "string",
              enum: ["name", "email", "company", "phone", "createdAt"],
              default: "createdAt",
            },
            sortOrder: {
              type: "string",
              enum: ["asc", "desc"],
              default: "desc",
            },
          },
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
        const search = (req.query.search || "").trim();
        const sortBy = req.query.sortBy || "createdAt";
        const sortOrder = req.query.sortOrder === "asc" ? "asc" : "desc";

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
                { phone: { contains: search, mode: "insensitive" } },
                { companyName: { contains: search, mode: "insensitive" } },
              ]
            : undefined,
        };

        let orderBy;
        switch (sortBy) {
          case "name":
            orderBy = [{ firstName: sortOrder }, { lastName: sortOrder }];
            break;
          case "email":
            orderBy = { email: sortOrder };
            break;
          case "company":
            orderBy = { companyName: sortOrder };
            break;
          case "phone":
            orderBy = { phone: sortOrder };
            break;
          default:
            orderBy = { createdAt: sortOrder };
        }

        /* ================= FETCH ================= */

        const [contacts, total] = await prisma.$transaction([
          prisma.contact.findMany({
            where,
            orderBy,
            skip,
            take: limit,
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
            totalPages: Math.ceil(total / limit) || 1,
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