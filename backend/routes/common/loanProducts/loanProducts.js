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
        where: {
          isActive: true, // optional but recommended
        },
        select: {
          id: true,
          code: true,
          name: true,
        },
      });

      // 👇 Priority based on ENUM (BEST PRACTICE)
      const priorityOrder = ["BRIDGE", "FIX_AND_FLIP", "DSCR"];

      const sortedProducts = products.sort((a, b) => {
        const aIndex = priorityOrder.indexOf(a.code);
        const bIndex = priorityOrder.indexOf(b.code);

        // Both priority
        if (aIndex !== -1 && bIndex !== -1) {
          return aIndex - bIndex;
        }

        // One priority
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;

        // Rest alphabetical by name
        return a.name.localeCompare(b.name);
      });

      reply.send({
        success: true,
        data: sortedProducts,
      });
    }
  );
}

module.exports = listLoanProducts;