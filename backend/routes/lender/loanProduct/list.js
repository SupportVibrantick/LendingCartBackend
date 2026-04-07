/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function listLenderLoanProductsRoutes(fastify) {
  fastify.get(
    "/",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Lender -> Loan Products"],
        summary: "List configured loan products (Advanced)",
        querystring: {
          type: "object",
          properties: {
            page: { type: "number", minimum: 1, default: 1 },
            limit: { type: "number", minimum: 1, maximum: 100, default: 10 },
            isActive: { type: "boolean" },
            search: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        // 🔐 AUTH CHECK
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

        // 📄 QUERY PARAMS
        const {
          page = 1,
          limit = 10,
          isActive,
          search,
        } = req.query;

        const skip = (page - 1) * limit;

        // 🔍 FILTERS
        const where = {
          lenderOrgId,
        };

        if (typeof isActive === "boolean") {
          where.isActive = isActive;
        }

        if (search) {
          where.OR = [
            {
              loanProductCode: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              loanProduct: {
                name: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            },
          ];
        }

        // 📊 QUERY
        const [products, total] = await Promise.all([
          prisma.lenderProduct.findMany({
            where,
            include: {
              loanProduct: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
          }),

          prisma.lenderProduct.count({ where }),
        ]);

        // 🧠 FORMAT RESPONSE (FIXED)
        const formatted = products.map((p) => ({
          ...p,

          // ✅ JSON fields (NO split)
          businessTypes: p.businessTypes ?? {},
          propertyTypes: p.propertyTypes ?? {},

          // ✅ CSV → array
          statesSupported: p.statesSupported
            ? p.statesSupported.split(",")
            : [],

          // ✅ array or null
          equipmentTypes: p.equipmentTypes ?? [],
        }));

        // 📦 RESPONSE
        return reply.send({
          success: true,
          meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
          data: formatted,
        });
      } catch (error) {
        req.log.error(error);

        return reply.status(500).send({
          success: false,
          message:
            error.message ||
            "Server error while fetching loan products",
        });
      }
    }
  );
}

module.exports = listLenderLoanProductsRoutes;