const {
  sortLoanProductsByPriority,
} = require("../../../utils/loanProducts/sortLoanProductsByPriority");

/**
 * Admin loan product list.
 * Default (no page/limit): full sorted list — same shape as common /loan-product-code.
 * With page/limit: paginated list for admin management screens.
 * @param {import("fastify").FastifyInstance} fastify
 */
async function listLoanProducts(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Admin -> Loan Products"],
        summary: "List all loan products",
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100 },
            search: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        const search = String(req.query.search || "").trim();
        const usePagination =
          req.query.page !== undefined || req.query.limit !== undefined;

        let products = await prisma.loanProduct.findMany();

        const filtered = search
          ? products.filter((product) => {
              const query = search.toLowerCase();
              return (
                String(product.name || "")
                  .toLowerCase()
                  .includes(query) ||
                String(product.description || "")
                  .toLowerCase()
                  .includes(query) ||
                String(product.code || "")
                  .toLowerCase()
                  .includes(query)
              );
            })
          : products;

        const sortedProducts = sortLoanProductsByPriority(filtered);

        if (!usePagination) {
          return reply.send({
            success: true,
            data: sortedProducts,
          });
        }

        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
        const total = sortedProducts.length;
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const safePage = Math.min(page, totalPages);
        const skip = (safePage - 1) * limit;
        const data = sortedProducts.slice(skip, skip + limit);

        return reply.send({
          success: true,
          data,
          pagination: {
            page: safePage,
            limit,
            total,
            totalPages,
            hasNextPage: safePage < totalPages,
            hasPreviousPage: safePage > 1,
          },
        });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          message: "Failed to fetch loan products",
        });
      }
    },
  );
}

module.exports = listLoanProducts;
