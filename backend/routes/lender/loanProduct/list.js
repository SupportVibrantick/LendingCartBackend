const {
  LENDER_PRODUCT_INCLUDE,
  formatLenderProductListItem,
} = require("../../../utils/lender/formatLenderProductListItem");

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
            page: {
              type: "number",
              minimum: 1,
              default: 1,
            },

            limit: {
              type: "number",
              minimum: 1,
              maximum: 100,
              default: 10,
            },

            isActive: {
              type: "boolean",
            },

            search: {
              type: "string",
            },
          },
        },
      },
    },

    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
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
        const { page = 1, limit = 10, isActive, search } = req.query;
        const skip = (page - 1) * limit;

        const where = {
          lenderOrgId,
        };

        if (typeof isActive === "boolean") {
          where.isActive = isActive;
        }

        if (search) {
          where.OR = [
            {
              loanProduct: {
                is: {
                  name: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              },
            },
          ];
        }

        const [products, total] = await Promise.all([
          prisma.lenderProduct.findMany({
            where,
            include: LENDER_PRODUCT_INCLUDE,
            orderBy: {
              createdAt: "desc",
            },
            skip,
            take: limit,
          }),

          prisma.lenderProduct.count({
            where,
          }),
        ]);

        const formatted = products.map(formatLenderProductListItem);

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
          message: error.message || "Server error while fetching loan products",
        });
      }
    },
  );
}

module.exports = listLenderLoanProductsRoutes;
