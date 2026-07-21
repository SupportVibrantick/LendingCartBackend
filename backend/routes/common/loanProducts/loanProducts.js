/**
 * Public API: List loan products
 * Sort order: Bridge → Fix & Flip → DSCR → Construction → CRE → SBA → ABL (see sortLoanProductsByPriority).
 */
const {
  sortLoanProductsByPriority,
} = require("../../../utils/loanProducts/sortLoanProductsByPriority");

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
          isActive: true,
        },
        select: {
          id: true,
          code: true,
          name: true,
        },
      });

      reply.send({
        success: true,
        data: sortLoanProductsByPriority(products),
      });
    },
  );
}

module.exports = listLoanProducts;
