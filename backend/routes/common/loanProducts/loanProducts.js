/**
 * Public API: List loan products
 */
async function listLoanProducts(fastify) {
  fastify.get(
    "/loan-product-code",
    {
      schema: {
        tags: ["Common → Loan Products"],
        summary: "Public list of loan products",
      },
    },
    async (_, reply) => {
      const prisma = fastify.prisma;
      const products = await prisma.loanProduct.findMany({
        select: {
          id: true,
          code: true,
          name: true,
        },
        orderBy: { createdAt: "desc" },
      });

      reply.send({
        success: true,
        data: products,
      });
    }
  );
}

module.exports = listLoanProducts;
